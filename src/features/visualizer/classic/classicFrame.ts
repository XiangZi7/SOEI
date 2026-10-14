// Adapted from Folia classic/Visualizer.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import type { Line, Word } from '../../lyrics/folia/model'
import {
  buildDisplayWordsFromLayoutUnits,
  buildPostLyricLayoutUnits,
} from '../../lyrics/folia/cjkSemanticLayout'
import { buildWordGraphemeTimings } from '../../lyrics/folia/graphemeTiming'
import { resolveWordColor } from '../../lyrics/folia/wordColoring'
import type { Theme } from '../../theme/model'
import { mixColors } from '../../theme/colorMath'
import {
  wordGlowEnvelope,
  wordGlowFilter,
  wordGlowTiming,
  type WordGlowTiming,
} from '../wordGlow'
import {
  buildClassicLayout,
  classicBreathing,
  classicWordStatus,
  getClassicWordActiveEndTime,
  getClassicWordDisplayDuration,
  resolveClassicLineRenderProfile,
  type ClassicTuning,
  type ClassicWordConfig,
  type ClassicLineRenderProfile,
} from './classicLayout'

export interface PreparedClassicWord {
  word: Word
  config: ClassicWordConfig
  activeColor: string
  graphemes: { char: string; timing: WordGlowTiming }[]
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
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount
const easeOut = (progress: number) => 1 - (1 - clamp(progress)) ** 3
// 上游 spring(stiffness=200, damping=20) 的解析阶跃响应，不依赖历史帧。
const spring = (elapsed: number) =>
  elapsed <= 0
    ? 0
    : elapsed >= 0.7
      ? 1
      : 1 -
        Math.exp(-10 * elapsed) *
          (Math.cos(10 * elapsed) + Math.sin(10 * elapsed))

export function classicWordFrame(
  prepared: PreparedClassicWord,
  profile: ClassicLineRenderProfile,
  timeSec: number,
  theme: Theme,
  staticMode = false
) {
  const { word, config, activeColor } = prepared
  const status = classicWordStatus(timeSec, word, profile)
  if (staticMode || word.estimated)
    return {
      status,
      transform: 'none',
      opacity: 1,
      color: theme.primaryColor,
      blur: 0,
      glows: prepared.graphemes.map(() => 'none'),
      rippleScale: 0.2,
      rippleOpacity: 0,
    }
  const elapsed = timeSec - (word.startTime - profile.wordLookahead)
  const activeEnd = getClassicWordActiveEndTime(word, profile)
  const activeElapsed = Math.max(
    0,
    Math.min(timeSec, activeEnd) - (word.startTime - profile.wordLookahead)
  )
  const arrival =
    profile.wordRevealMode === 'instant'
      ? elapsed >= 0
        ? 1
        : 0
      : profile.wordRevealMode === 'fast'
        ? easeOut(activeElapsed / 0.12)
        : spring(activeElapsed)
  const passedElapsed = Math.max(0, timeSec - activeEnd)
  const passed = status === 'passed' ? easeOut(passedElapsed / 0.5) : 0
  const x = lerp(config.x + Math.sin(config.y) * 100, config.x, arrival)
  const y = lerp(config.y + Math.cos(config.x) * 50, config.y, arrival)
  const activeScale = lerp(0.5, config.scale * 1.4, arrival)
  const scale = lerp(activeScale, config.scale, passed)
  const rotation =
    lerp(
      config.rotate + (config.rotate || config.passedRotate ? 20 : 0),
      config.rotate,
      arrival
    ) +
    config.passedRotate * clamp(passedElapsed / 5)
  const activeOpacity =
    profile.wordRevealMode === 'instant' && elapsed >= 0
      ? 1
      : clamp(activeElapsed / 0.1)
  const opacity =
    status === 'waiting'
      ? 0
      : lerp(
          activeOpacity,
          theme.animationIntensity === 'chaotic' ? 0.9 : 0.82,
          passed
        )
  const colorArrival = clamp(
    activeElapsed / getClassicWordDisplayDuration(word, profile)
  )
  const colorFadeDuration =
    profile.wordRevealMode === 'instant'
      ? 0.12
      : profile.wordRevealMode === 'fast'
        ? 0.24
        : 0.8
  const colorAmount =
    colorArrival * (1 - clamp(passedElapsed / colorFadeDuration))
  const blurDuration =
    profile.wordRevealMode === 'instant'
      ? 0.08
      : profile.wordRevealMode === 'fast'
        ? 0.12
        : 0.2
  const glows = prepared.graphemes.map(grapheme => {
    const peak =
      status === 'waiting'
        ? 0
        : wordGlowEnvelope(grapheme.timing, elapsed) * (1 - passed)
    return wordGlowFilter(activeColor, grapheme.timing, peak)
  })
  const rippleProgress = clamp(elapsed / 0.5)
  const rippleTarget = 1.5 + (Math.sin(word.startTime * 13 + config.x) + 1)
  return {
    status,
    transform:
      'translate(' +
      x.toFixed(3) +
      'px, ' +
      y.toFixed(3) +
      'px) rotate(' +
      rotation.toFixed(3) +
      'deg) scale(' +
      scale.toFixed(4) +
      ')',
    opacity,
    color: mixColors(theme.primaryColor, activeColor, colorAmount),
    blur: 10 * (1 - easeOut(activeElapsed / blurDuration)),
    glows,
    rippleScale: lerp(0.2, rippleTarget, easeOut(rippleProgress)),
    rippleOpacity: status === 'active' ? 0.8 * (1 - rippleProgress) : 0,
  }
}

export function classicLineFrame(
  prepared: PreparedClassicLine,
  timeSec: number,
  staticMode = false
) {
  if (staticMode)
    return {
      opacity: 1,
      transform: 'none',
      filter: 'none',
      floatTransform: 'none',
    }
  const mode = prepared.profile.lineTransitionMode
  const duration = mode === 'fast' ? 0.16 : mode === 'none' ? 0 : 0.35
  const arrival = duration
    ? easeOut((timeSec - prepared.line.startTime) / duration)
    : 1
  const exitDuration = mode === 'normal' ? 0.3 : mode === 'fast' ? 0.16 : 0.12
  const exit = easeOut(
    (timeSec - prepared.profile.lineRenderEndTime) / exitDuration
  )
  const initialScale = mode === 'fast' ? 0.96 : mode === 'none' ? 1 : 0.9
  const blur =
    (mode === 'fast' ? 4 : mode === 'none' ? 0 : 10) * (1 - arrival) +
    (mode === 'normal' ? 20 : 10) * exit
  let floatTransform = 'none'
  if (prepared.breathing) {
    const { distancePx, durationSec, scaleAmount } = prepared.breathing
    const phase =
      (Math.max(0, timeSec - prepared.line.startTime) / durationSec) *
      Math.PI *
      2
    floatTransform =
      'translateY(' +
      (-Math.sin(phase) * distancePx).toFixed(3) +
      'px) scale(' +
      (1 + Math.sin(phase) * scaleAmount).toFixed(4) +
      ')'
  }
  return {
    opacity:
      lerp(mode === 'fast' ? 0.35 : mode === 'none' ? 1 : 0, 1, arrival) *
      (1 - exit),
    transform:
      'scale(' + (lerp(initialScale, 1, arrival) + 0.1 * exit).toFixed(4) + ')',
    filter: blur < 0.01 ? 'none' : 'blur(' + blur.toFixed(3) + 'px)',
    floatTransform,
  }
}
