// Adapted from Folia partita/VisualizerPartita.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import type { Line, Word } from '../../lyrics/folia/model'
import {
  buildDisplayWordsFromLayoutUnits,
  buildPostLyricLayoutUnits,
  type LyricLayoutUnit,
} from '../../lyrics/folia/cjkSemanticLayout'
import { getWordSegmentationKey } from '../../lyrics/folia/wordSegmentation'
import type { Theme } from '../../theme/model'

// 云阶：歌词切成不均匀的 chunk 排成竖列，每行自带错落偏移与导引线。
// 从 Folia partita/VisualizerPartita.tsx 抽出布局部分，便于单测。
//
// 术语（沿用上游 partita/README.md）：
//   word        —— 解析器产出的原始计时词，timing 的唯一真源
//   layoutUnit  —— 分行前的规划单元，可能是一个词、一个 CJK 语义词组，或粘滞了标点的显示单元
//   chunk       —— 一行可见 row，由连续的 layoutUnit 组成
//   displayWord —— 最终交给渲染的文字单元
//
// 上游还有一个 `getTargetColumnCount`，但它**从未被调用**：buildSequentialColumns 永远只建
// 一个 column，真正的结构是单列内的多个 chunk。这里不照搬那段死代码。

export interface PartitaTuning {
  showGuideLines: boolean
  useSemanticLayout: boolean
  staggerMin: number
  staggerMax: number
}

export const DEFAULT_PARTITA_TUNING: PartitaTuning = {
  showGuideLines: true,
  useSemanticLayout: true,
  staggerMin: 20,
  staggerMax: 100,
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))
const clampStagger = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, 0, 180)
    : fallback

export function resolvePartitaTuning(tuning?: unknown): PartitaTuning {
  const source = (tuning ?? {}) as Partial<PartitaTuning>
  const min = clampStagger(source.staggerMin, DEFAULT_PARTITA_TUNING.staggerMin)
  const max = clampStagger(source.staggerMax, DEFAULT_PARTITA_TUNING.staggerMax)
  return {
    showGuideLines:
      source.showGuideLines ?? DEFAULT_PARTITA_TUNING.showGuideLines,
    useSemanticLayout:
      source.useSemanticLayout ?? DEFAULT_PARTITA_TUNING.useSemanticLayout,
    // 顺序反了也要能用：取两者的较小/较大值。
    staggerMin: Math.min(min, max),
    staggerMax: Math.max(min, max),
  }
}

const graphemeSegmenter =
  typeof Intl !== 'undefined'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null
function splitGraphemes(text: string): string[] {
  if (!text) return []
  if (graphemeSegmenter)
    return Array.from(graphemeSegmenter.segment(text), item => item.segment)
  return Array.from(text)
}

/** chunk 级的 transform 配置。 */
export interface PartitaChunkConfig {
  id: string
  x: number
  y: number
  rotate: number
  scale: number
  marginBottom: string
  passedRotate: number
}

export interface PartitaChunk {
  chunkUnits: LyricLayoutUnit[]
  /** chunk 内全部原始计时词，保留 timing 边界。 */
  chunkWords: Word[]
  /** 最终可渲染的文字单元。 */
  displayWords: Word[]
  config: PartitaChunkConfig
  rowIndex: number
}

export interface PartitaLayout {
  chunks: PartitaChunk[]
  totalGraphemes: number
  perspective: number
}

export const EMPTY_PARTITA_LAYOUT: PartitaLayout = {
  chunks: [],
  totalGraphemes: 0,
  perspective: 1000,
}

/** 一行最多能用多少个可见 row，由可用高度决定。 */
const BASE_ROW_HEIGHT = 100
const AVAILABLE_HEIGHT_RATIO = 0.65

/**
 * 普通 LRC 在 SOEI 里没有词时间，`line.words` 是空数组，
 * `buildPostLyricLayoutUnits` 因此返回空 —— 不兜底的话 partita 会什么都不显示。
 * 这里合成一个覆盖整句的估计单元，让它至少完整显示文字（没有演唱高亮）。
 */
function fallbackLayoutUnits(line: Line): LyricLayoutUnit[] {
  if (!line.fullText) return []
  const word: Word = {
    text: line.fullText,
    startTime: line.startTime,
    endTime: line.endTime,
    estimated: true,
  }
  return [
    {
      text: line.fullText,
      words: [word],
      startTime: line.startTime,
      endTime: line.endTime,
      isSemantic: false,
    },
  ]
}

export interface PartitaLayoutInput {
  line: Line
  theme: Theme
  /** 舞台可用高度（px）。 */
  stageHeight: number
  tuning: PartitaTuning
}

/**
 * 把一行切成不均匀的 chunk。
 *
 * **刻意不做平均切分** —— 上游注释说完全均分看着太机械，会毁掉手写乐谱的错落感。
 * 种子取行的开始时间，且随机数按序消耗（seed++），所以同一行每次得到同一套构图。
 */
export function buildPartitaLayout({
  line,
  theme,
  stageHeight,
  tuning,
}: PartitaLayoutInput): PartitaLayout {
  const intensity = theme.animationIntensity
  const isChaotic = intensity === 'chaotic'
  const isCalm = intensity === 'calm'
  const totalGraphemes = Math.max(
    splitGraphemes(line.fullText.replace(/\s+/g, '')).length,
    line.words.length,
    1
  )
  const layoutUnits = buildPostLyricLayoutUnits(line, {
    semantic: tuning.useSemanticLayout,
    sticky: true,
  })
  const units = layoutUnits.length ? layoutUnits : fallbackLayoutUnits(line)
  if (!units.length)
    return { chunks: [], totalGraphemes, perspective: isChaotic ? 720 : 1000 }

  const targetRowCount = Math.max(
    1,
    Math.floor((stageHeight * AVAILABLE_HEIGHT_RATIO) / BASE_ROW_HEIGHT)
  )
  const rowCount = Math.min(units.length, targetRowCount)

  // 顺序消耗的伪随机：与上游逐次 seed++ 的行为一致。
  let seed = line.startTime
  const random = () => {
    const value = Math.sin(seed++) * 10000
    return value - Math.floor(value)
  }

  const groups: LyricLayoutUnit[][] = []
  let remainingUnits = units.length
  let remainingChunks = rowCount
  let cursor = 0
  for (let index = 0; index < rowCount; index += 1) {
    const isLast = index === rowCount - 1
    const average = remainingUnits / remainingChunks
    let length = remainingUnits
    if (!isLast) {
      const max = Math.ceil(average * 1.5)
      length = Math.max(
        1,
        Math.min(max, Math.round(average + (random() - 0.5) * average))
      )
    }
    // 给后面每个 chunk 至少留一个单元。
    length = Math.max(
      1,
      Math.min(length, remainingUnits - (remainingChunks - 1))
    )
    groups.push(units.slice(cursor, cursor + length))
    cursor += length
    remainingUnits -= length
    remainingChunks -= 1
  }

  const chunks: PartitaChunk[] = []
  groups.forEach((chunkUnits, rowIndex) => {
    const chunkWords = chunkUnits.flatMap(unit => unit.words)
    if (!chunkWords.length) return
    const displayWords = buildDisplayWordsFromLayoutUnits(chunkUnits)
    const mergedText = chunkWords.map(word => word.text.trim()).join('')
    const graphemeCount = splitGraphemes(mergedText.replace(/\s+/g, '')).length
    const rowBias = rowIndex - (rowCount - 1) / 2
    const staggeredLeft = rowIndex % 2 === 0

    // 错落是 partita 的核心动作：各行要有偏移与次序感，但整体仍读得出是一句。
    const magnitude =
      tuning.staggerMin +
      random() * Math.max(tuning.staggerMax - tuning.staggerMin, 0)
    const staggerScale = isCalm ? 1 : 0.8 + random() * 0.9

    chunks.push({
      chunkUnits,
      chunkWords,
      displayWords,
      rowIndex,
      config: {
        id: `${rowIndex}-${chunkWords[0]!.startTime}`,
        x: staggeredLeft ? -magnitude : magnitude,
        y: isCalm ? 0 : rowBias * 2.5,
        rotate: isChaotic ? (staggeredLeft ? -3 : 3) : 0,
        scale:
          (isChaotic ? 1 + Math.min(graphemeCount * 0.01, 0.05) : 1) *
          staggerScale,
        marginBottom: isChaotic ? '0.4rem' : '0.6rem',
        passedRotate: (staggeredLeft ? 1 : -1) * (isChaotic ? 6 : 3),
      },
    })
  })

  return { chunks, totalGraphemes, perspective: isChaotic ? 720 : 1000 }
}

/**
 * 布局缓存键。包含歌词内容、主题、舞台高度与 tuning。
 *
 * 用户保存的分词会经 buildPostLyricLayoutUnits 改变分行，所以必须计入 ——
 * 上游记录过这个 bug：缓存只受 LRU 限制、活得比重新分词久，
 * 不带这一项会让已经在屏幕上的那一行保留按旧分词算出的布局。
 */
export function partitaLayoutCacheKey(
  line: Line,
  theme: Theme,
  stageHeight: number,
  tuning: PartitaTuning
): string {
  return [
    'partita-v1',
    line.startTime,
    line.endTime,
    line.words.length,
    line.fullText,
    getWordSegmentationKey(line),
    theme.animationIntensity,
    theme.fontWeight ?? 'auto',
    // 高度按 24px 分桶，拖动窗口时不会每像素都重建。
    Math.round(stageHeight / 24),
    tuning.staggerMin,
    tuning.staggerMax,
    tuning.showGuideLines ? 1 : 0,
    tuning.useSemanticLayout ? 1 : 0,
  ].join('|')
}

/** chunk 内每个 display word 的随机偏移。chunk 自身的位置在容器上，这里只做词级抖动。 */
export function partitaWordConfig(
  chunk: PartitaChunk,
  wordIndex: number,
  theme: Theme
): {
  x: number
  y: number
  rotate: number
  scale: number
  passedRotate: number
} {
  const base = chunk.displayWords[0]?.startTime ?? 0
  const wordSeed = base + wordIndex * 7.13
  const random = (offset: number) => {
    const value = Math.sin(wordSeed + offset) * 10000
    return value - Math.floor(value)
  }
  const intensity = theme.animationIntensity
  const isChaotic = intensity === 'chaotic'
  const isCalm = intensity === 'calm'
  const spread = isChaotic ? 15 : isCalm ? 0 : 6
  const rotate = isChaotic ? 8 : isCalm ? 0 : 3
  return {
    x: (random(1) - 0.5) * spread * 2,
    y: (random(2) - 0.5) * spread * 2,
    rotate: (random(3) - 0.5) * rotate * 2,
    // 词继承所在 chunk 的缩放。
    scale: chunk.config.scale,
    passedRotate: (random(8) - 0.5) * 20,
  }
}

/** 字数密集时整体缩一档，避免长句撑出舞台。 */
export const partitaDensityScale = (totalGraphemes: number) =>
  totalGraphemes > 40 ? 0.8 : 1

export function partitaFontSize(
  totalGraphemes: number,
  lyricsFontScale: number
): string {
  const scale = partitaDensityScale(totalGraphemes) * lyricsFontScale
  return `clamp(${(2.5 * scale).toFixed(3)}rem, ${(5.5 * scale).toFixed(3)}vw, ${(4.5 * scale).toFixed(3)}rem)`
}
