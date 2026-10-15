// Adapted from Folia partita/VisualizerPartita.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import type { Line } from '../../lyrics/folia/model'
import { buildWordGraphemeTimings } from '../../lyrics/folia/graphemeTiming'
import { resolveWordColor } from '../../lyrics/folia/wordColoring'
import { colorWithAlpha } from '../../theme/colorMath'
import { clamp01, lerp, springStep } from '../easing'
import { wordGlowTiming } from '../wordGlow'
import {
  resolveWordRevealProfile,
  wordActiveEndTime,
  type PreparedRevealWord,
  type WordRevealProfile,
  type WordRevealStatus,
} from '../wordReveal'
import {
  buildPartitaLayout,
  partitaWordConfig,
  type PartitaChunk,
  type PartitaLayoutInput,
} from './partitaLayout'

// partita 在共享的词级揭示之上多一层 **chunk 级**状态：
// 一行（chunk）整体有自己的 waiting/active/passed 与导引线。
// 词级的 transform/颜色/发光仍然走 ../wordReveal.ts，与 classic 共用一份实现。

/** 导引线在未激活时的颜色。上游写死成白色低透明度，与主题无关。 */
const GUIDE_IDLE = 'rgba(255, 255, 255, 0.14)'
const GUIDE_PASSED = 'rgba(255, 255, 255, 0.22)'
/** waiting 时 chunk 额外朝导引线一侧退开的距离。 */
const CHUNK_ENTER_OFFSET = 40

export interface PreparedPartitaWord extends PreparedRevealWord {
  config: ReturnType<typeof partitaWordConfig>
}

export interface PreparedPartitaChunk {
  chunk: PartitaChunk
  words: PreparedPartitaWord[]
  /** chunk 的激活色，取自整段文字的关键字匹配。 */
  activeColor: string
  startTime: number
  endTime: number
  /** 导引线在左还是右，按行序交替。 */
  guide: 'left' | 'right'
}

export interface PreparedPartitaLine {
  line: Line
  profile: WordRevealProfile
  chunks: PreparedPartitaChunk[]
  totalGraphemes: number
  perspective: number
}

/** 编译一行：布局 + 每个 chunk 的时间边界 + 每个词的发光时序。 */
export function preparePartitaLine(
  input: PartitaLayoutInput
): PreparedPartitaLine {
  const { line, theme } = input
  const profile = resolveWordRevealProfile(line)!
  const layout = buildPartitaLayout(input)
  return {
    line,
    profile,
    totalGraphemes: layout.totalGraphemes,
    perspective: layout.perspective,
    chunks: layout.chunks.map(chunk => {
      const last = chunk.chunkWords[chunk.chunkWords.length - 1]!
      return {
        chunk,
        // chunk 的时间窗口来自原始计时词，所以标点被合并显示也不影响动画时序。
        startTime: chunk.chunkWords[0]!.startTime,
        endTime: wordActiveEndTime(last, profile),
        activeColor: resolveWordColor(
          chunk.displayWords.map(word => word.text).join(' '),
          theme.wordColors,
          theme.accentColor
        ),
        guide: chunk.rowIndex % 2 === 0 ? 'left' : 'right',
        words: chunk.displayWords.map<PreparedPartitaWord>((word, index) => ({
          word,
          config: partitaWordConfig(chunk, index, theme),
          activeColor: resolveWordColor(
            word.text,
            theme.wordColors,
            theme.accentColor
          ),
          graphemes: buildWordGraphemeTimings(word).map(
            (grapheme, charIndex, all) => ({
              char: grapheme.char,
              timing: wordGlowTiming({
                mode:
                  profile.wordRevealMode === 'normal'
                    ? all.length > 1
                      ? 'sweep'
                      : 'sustained'
                    : profile.wordRevealMode,
                durationSec: Math.max(word.endTime - word.startTime, 0.1),
                total: all.length,
                index: charIndex,
                charStartSec: grapheme.startTime,
                charEndSec: grapheme.endTime,
                wordStartSec: word.startTime,
              }),
            })
          ),
        })),
      }
    }),
  }
}

/** chunk 的状态，判定规则与词级一致，只是用 chunk 的时间边界。 */
export function partitaChunkStatus(
  timeSec: number,
  chunk: PreparedPartitaChunk,
  profile: WordRevealProfile
): WordRevealStatus {
  if (
    timeSec >= chunk.startTime - profile.wordLookahead &&
    timeSec <= chunk.endTime
  )
    return 'active'
  if (timeSec > chunk.endTime) return 'passed'
  return 'waiting'
}

const easeOut = (progress: number) => 1 - (1 - clamp01(progress)) ** 3
/** 与词级同一条 spring(200, 20)，走共享的解析阶跃响应。 */
const spring = springStep(200, 20, 1, 0.7)

export interface PartitaChunkFrame {
  status: WordRevealStatus
  transform: string
  opacity: number
  /** 导引线：颜色、发光与两个方向的展开比例。 */
  guideColor: string
  guideGlowVertical: string
  guideGlowHorizontal: string
  guideScale: number
}

/**
 * chunk 的逐帧状态。入场时朝导引线一侧退开 40px 再弹回；
 * active 用 spring，其余用 0.4s 的 easeOut，与上游一致。
 */
export function partitaChunkFrame(
  chunk: PreparedPartitaChunk,
  profile: WordRevealProfile,
  timeSec: number,
  staticMode = false
): PartitaChunkFrame {
  const status = partitaChunkStatus(timeSec, chunk, profile)
  const { config } = chunk.chunk
  if (staticMode)
    return {
      status,
      transform: 'none',
      opacity: 1,
      guideColor: GUIDE_IDLE,
      guideGlowVertical: 'none',
      guideGlowHorizontal: 'none',
      guideScale: 1,
    }

  const elapsed = timeSec - (chunk.startTime - profile.wordLookahead)
  // active 走 spring，离场/等待走 0.4 秒的 easeOut。
  const arrival =
    status === 'active' ? spring(Math.max(0, elapsed)) : easeOut(elapsed / 0.4)
  const entered = status === 'waiting' ? 0 : arrival
  const offset =
    chunk.guide === 'left' ? -CHUNK_ENTER_OFFSET : CHUNK_ENTER_OFFSET
  const x = lerp(config.x + offset, config.x, entered)
  const scale = lerp(0.85, config.scale, entered)
  const passedElapsed = Math.max(0, timeSec - chunk.endTime)
  const rotation =
    config.rotate + config.passedRotate * clamp01(passedElapsed / 5)

  const guideColor =
    status === 'active'
      ? chunk.activeColor
      : status === 'passed'
        ? GUIDE_PASSED
        : GUIDE_IDLE
  const glow = (alpha: number) =>
    status === 'active'
      ? `0 0 10px ${colorWithAlpha(chunk.activeColor, alpha)}`
      : 'none'

  return {
    status,
    transform:
      'translate(' +
      x.toFixed(3) +
      'px, ' +
      config.y.toFixed(3) +
      'px) rotate(' +
      rotation.toFixed(3) +
      'deg) scale(' +
      scale.toFixed(4) +
      ')',
    opacity: status === 'waiting' ? 0 : clamp01(entered),
    guideColor,
    // 上游用 45/35 的十六进制 alpha 后缀，约等于 0.27 / 0.21。
    guideGlowVertical: glow(0x45 / 255),
    guideGlowHorizontal: glow(0x35 / 255),
    guideScale: status === 'waiting' ? 0 : clamp01(entered),
  }
}
