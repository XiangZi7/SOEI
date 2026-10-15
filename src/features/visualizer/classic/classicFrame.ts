// Adapted from Folia classic/Visualizer.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import type { Line, Word } from '../../lyrics/folia/model'
import {
  buildDisplayWordsFromLayoutUnits,
  buildPostLyricLayoutUnits,
} from '../../lyrics/folia/cjkSemanticLayout'
import { buildWordGraphemeTimings } from '../../lyrics/folia/graphemeTiming'
import { resolveWordColor } from '../../lyrics/folia/wordColoring'
import type { Theme } from '../../theme/model'
import { wordGlowTiming } from '../wordGlow'
import {
  breathingFrame,
  lineRevealFrame,
  wordRevealFrame,
  type PreparedRevealWord,
} from '../wordReveal'
import {
  buildClassicLayout,
  classicBreathing,
  getClassicWordDisplayDuration,
  resolveClassicLineRenderProfile,
  type ClassicTuning,
  type ClassicWordConfig,
} from './classicLayout'

/**
 * classic 的已备词。它是共享的 PreparedRevealWord 加上 classic 自己的排版字段
 * （右边距、对齐、id），所以可以直接交给 wordRevealFrame。
 */
export interface PreparedClassicWord extends PreparedRevealWord {
  config: ClassicWordConfig
}

/** 普通 LRC 保留完整句子；有词时间时保留原文中未写进词数组的空格与标点。 */
export function classicDisplayWords(line: Line, tuning: ClassicTuning): Word[] {
  if (!line.words.length || line.words.every(word => word.estimated))
    return [
      {
        text: line.fullText,
        startTime: line.startTime,
        endTime: line.endTime,
        estimated: true,
      },
    ]
  const words = tuning.useLegacyLayout
    ? line.words
    : buildDisplayWordsFromLayoutUnits(
        buildPostLyricLayoutUnits(line, { semantic: true, sticky: true })
      )
  const result: Word[] = []
  let cursor = 0
  for (const word of words) {
    const start = line.fullText.indexOf(word.text, cursor)
    if (start < 0)
      return [
        {
          text: line.fullText,
          startTime: line.startTime,
          endTime: line.endTime,
          estimated: true,
        },
      ]
    if (start > cursor)
      result.push({
        text: line.fullText.slice(cursor, start),
        startTime: word.startTime,
        endTime: word.startTime,
        estimated: true,
      })
    result.push(word)
    cursor = start < 0 ? cursor : start + word.text.length
  }
  if (cursor > 0 && cursor < line.fullText.length)
    result.push({
      text: line.fullText.slice(cursor),
      startTime: line.endTime,
      endTime: line.endTime,
      estimated: true,
    })
  return result
}

export function prepareClassicLine(input: {
  line: Line
  theme: Theme
  tuning: ClassicTuning
  lyricsFontScale: number
  viewportWidth: number
  seed?: string | number
}) {
  const { line, theme, tuning } = input
  const profile = resolveClassicLineRenderProfile(line)!
  const words = classicDisplayWords(line, tuning)
  const layout = buildClassicLayout({ ...input, words })
  return {
    line,
    profile,
    lineConfig: layout.lineConfig,
    breathing: classicBreathing(tuning, theme.animationIntensity),
    words: words.map<PreparedClassicWord>((word, index) => {
      const config = layout.wordConfigs[index]!
      const durationSec = getClassicWordDisplayDuration(word, profile)
      const graphemes = buildWordGraphemeTimings(word)
      return {
        word,
        config: word.estimated
          ? {
              ...config,
              x: 0,
              y: 0,
              rotate: 0,
              passedRotate: 0,
              scale: 1,
              marginRight: '0px',
              alignSelf: 'auto',
            }
          : config,
        activeColor: resolveWordColor(
          word.text,
          theme.wordColors,
          theme.accentColor
        ),
        graphemes: graphemes.map((grapheme, charIndex) => ({
          char: grapheme.char,
          timing: wordGlowTiming({
            mode:
              profile.wordRevealMode === 'normal'
                ? graphemes.length > 1
                  ? 'sweep'
                  : 'sustained'
                : profile.wordRevealMode,
            durationSec,
            total: graphemes.length,
            index: charIndex,
            charStartSec: grapheme.startTime,
            charEndSec: grapheme.endTime,
            wordStartSec: word.startTime,
          }),
        })),
      }
    }),
  }
}

export type PreparedClassicLine = ReturnType<typeof prepareClassicLine>

// 词级与行级的逐帧求值是 classic 与 partita 共用的，实现收在 ../wordReveal.ts。
// 这里保留 classic 的名字作为别名，ClassicLine.vue 与测试不受影响。
export const classicWordFrame = wordRevealFrame

export function classicLineFrame(
  prepared: PreparedClassicLine,
  timeSec: number,
  staticMode = false
) {
  const frame = lineRevealFrame(
    prepared.profile,
    prepared.line.startTime,
    timeSec,
    staticMode
  )
  return {
    ...frame,
    floatTransform:
      staticMode || !prepared.breathing
        ? 'none'
        : breathingFrame(prepared.breathing, prepared.line.startTime, timeSec),
  }
}
