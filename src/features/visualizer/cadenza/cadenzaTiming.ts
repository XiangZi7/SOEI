// Adapted from Folia cadenza/VisualizerCadenza.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import type { Line, Word } from '../../lyrics/folia/model'
import type { GraphemeTiming } from '../../lyrics/folia/graphemeTiming'
import {
  getLineRenderHints,
  getLineTransitionTiming,
  type LineRenderHints,
  type LineTransitionTiming,
  type WordRevealMode,
} from '../../lyrics/folia/renderHints'
import { clamp01, lerp } from '../easing'

// cadenza 的词级包络。
//
// 上游把这几个函数命名为 `getClassic*`，但它们和 classic 已经各自漂移：
// 预读窗口（0.18/0.045/0）、发光包络的平台形状、以及整行进出场改用真实的
// `getLineTransitionTiming` 而不是硬编码时长 —— 都与 SOEI 的 `wordReveal.ts` 不同。
// 合并会改变两个模式的观感，所以这里按上游保持独立实现。

const easeOutCubic = (value: number) => 1 - (1 - clamp01(value)) ** 3
const easeInOutQuad = (value: number) => {
  const normalized = clamp01(value)
  return normalized < 0.5
    ? 2 * normalized * normalized
    : 1 - (-2 * normalized + 2) ** 2 / 2
}

/** 活跃词的脉动频率（rad/s）。 */
export const CADENZA_ACTIVE_PULSE_FREQUENCY = 10

export interface CadenzaLineTiming {
  renderHints: LineRenderHints | null
  lineRenderEndTime: number
  wordRevealMode: WordRevealMode
  /** 最后一个词的结束时刻，决定整行什么时候开始「过气」。 */
  lastWordEndTime: number
  linePassHold: number
  transitionTiming: LineTransitionTiming
}

/**
 * cadenza 要的不只是 `line.endTime`：它还得知道这行什么时候不再「活跃」，
 * 以及 pass-hold 该留多久。
 */
export function resolveCadenzaLineTiming(line: Line): CadenzaLineTiming {
  const renderHints = getLineRenderHints(line)
  const wordRevealMode = renderHints?.wordRevealMode ?? 'normal'
  const lastWord = line.words[line.words.length - 1]
  const rawDuration =
    renderHints?.rawDuration ?? Math.max(line.endTime - line.startTime, 0)
  const transitionTiming = getLineTransitionTiming(
    rawDuration,
    renderHints?.lineTransitionMode ?? 'normal',
    wordRevealMode
  )
  return {
    renderHints,
    lineRenderEndTime: renderHints?.renderEndTime ?? line.endTime,
    wordRevealMode,
    lastWordEndTime: lastWord?.endTime ?? line.endTime,
    linePassHold: transitionTiming.linePassHold,
    transitionTiming,
  }
}

export type CadenzaWordStatus = 'waiting' | 'active' | 'passed'

export function cadenzaWordStatus(
  timeSec: number,
  timing: CadenzaLineTiming,
  word: Word
): CadenzaWordStatus {
  const lookahead =
    timing.wordRevealMode === 'fast'
      ? 0.045
      : timing.wordRevealMode === 'instant'
        ? 0
        : 0.18
  const activeEndTime =
    timing.wordRevealMode === 'instant'
      ? timing.lineRenderEndTime
      : word.endTime
  if (timeSec >= word.startTime - lookahead && timeSec <= activeEndTime)
    return 'active'
  if (timeSec > activeEndTime) return 'passed'
  return 'waiting'
}

export function cadenzaWordProgress(
  timeSec: number,
  wordRevealMode: WordRevealMode,
  word: Word
): number {
  if (wordRevealMode === 'instant') return timeSec < word.startTime ? 0 : 1
  const minDuration = wordRevealMode === 'fast' ? 0.045 : 0.01
  const duration = Math.max(word.endTime - word.startTime, minDuration)
  return clamp01((timeSec - word.startTime) / duration)
}

/** 关键帧形状：前 30% 升到 1，之后线性落回 0。两端都返回 0。 */
export function cadenzaKeyframedGlow(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0
  if (progress < 0.3) return easeOutCubic(progress / 0.3)
  return 1 - clamp01((progress - 0.3) / 0.7)
}

/** 词级发光包络：升起 → 平台 → 衰减。三种 reveal 模式的时长与收尾各不相同。 */
export function cadenzaGlowEnvelope(
  timeSec: number,
  timing: CadenzaLineTiming,
  word: Word
): number {
  if (timing.wordRevealMode === 'instant') {
    if (timeSec < word.startTime || timeSec > timing.lineRenderEndTime) return 0
    return cadenzaKeyframedGlow(clamp01((timeSec - word.startTime) / 0.067))
  }

  if (timing.wordRevealMode === 'fast') {
    const duration = Math.max(word.endTime - word.startTime, 0.045)
    if (timeSec < word.startTime) return 0
    if (timeSec <= word.endTime) {
      const progress = clamp01((timeSec - word.startTime) / duration)
      if (progress < 0.14) return easeOutCubic(progress / 0.14)
      if (progress < 0.82) return 1
      return lerp(1, 0.92, (progress - 0.82) / 0.18)
    }
    return (1 - clamp01((timeSec - word.endTime) / 0.14)) ** 2
  }

  const duration = Math.max(word.endTime - word.startTime, 0.1)
  if (timeSec < word.startTime) return 0
  if (timeSec <= word.endTime) {
    const progress = clamp01((timeSec - word.startTime) / duration)
    if (progress < 0.18) return easeOutCubic(progress / 0.18)
    if (progress < 0.9) return 1
    return lerp(1, 0.9, (progress - 0.9) / 0.1)
  }
  return 0.9 * (1 - clamp01((timeSec - word.endTime) / 0.9)) ** 2
}

/**
 * 逐字发光。有真实字素时间就用它，否则按词时长均分。
 * 动画时长取字时长的 6 倍 —— 淡出要跨过后面几个字才自然。
 */
export function cadenzaCharGlow(
  timeSec: number,
  word: Word,
  glyphIndex: number,
  glyphCount: number,
  graphemeTimings: GraphemeTiming[] = []
): number {
  const duration = Math.max(word.endTime - word.startTime, 0.1)
  const singleDuration = duration / Math.max(glyphCount, 1)
  const timing = graphemeTimings[glyphIndex]
  const charDuration = timing
    ? Math.max(timing.endTime - timing.startTime, 0.001)
    : singleDuration
  const charStartTime =
    timing?.startTime ?? word.startTime + singleDuration * glyphIndex
  const elapsed = timeSec - charStartTime
  const activeGlow =
    elapsed <= 0 ? 0 : cadenzaKeyframedGlow(elapsed / (charDuration * 6))
  if (timeSec <= word.endTime) return activeGlow
  return activeGlow * (1 - clamp01((timeSec - word.endTime) / 0.9)) ** 2
}

/** 正文颜色从主色混到高亮色的比例。词唱完后按模式淡回去。 */
export function cadenzaBodyMix(
  timeSec: number,
  timing: CadenzaLineTiming,
  word: Word
): number {
  if (timing.wordRevealMode === 'instant') {
    if (timeSec < word.startTime) return 0
    return timeSec <= timing.lineRenderEndTime ? 1 : 0
  }
  if (timeSec < word.startTime) return 0
  if (timeSec <= word.endTime)
    return cadenzaWordProgress(timeSec, timing.wordRevealMode, word)
  const fadeDuration = timing.wordRevealMode === 'fast' ? 0.12 : 0.8
  return 1 - clamp01((timeSec - word.endTime) / fadeDuration)
}

export interface CadenzaLineEnvelope {
  opacity: number
  scale: number
  blur: number
}

/** 整行容器的进出场。`none` 不做过渡，`fast` 只做轻微的位移与模糊。 */
export function cadenzaLineEnvelope(
  timeSec: number,
  line: Line | null,
  timing: CadenzaLineTiming
): CadenzaLineEnvelope {
  if (!line) return { opacity: 1, scale: 1, blur: 0 }

  const mode = timing.renderHints?.lineTransitionMode
  if (mode === 'none') return { opacity: 1, scale: 1, blur: 0 }

  const lineEndTime = timing.lineRenderEndTime
  const linePassStart =
    Math.max(timing.lastWordEndTime, line.startTime) + timing.linePassHold
  const { enterDuration, exitDuration } = timing.transitionTiming

  if (mode === 'fast') {
    const exitStart = Math.max(
      line.startTime + enterDuration + 0.01,
      linePassStart,
      lineEndTime - exitDuration
    )
    const enterProgress = easeOutCubic(
      clamp01((timeSec - line.startTime) / enterDuration)
    )
    let opacity = lerp(0.65, 1, enterProgress)
    let scale = lerp(0.97, 1, enterProgress)
    let blur = lerp(4, 0, enterProgress)
    const exitProgress = easeOutCubic(
      clamp01((timeSec - exitStart) / exitDuration)
    )
    if (exitProgress > 0) {
      opacity = lerp(opacity, 0, exitProgress)
      scale = lerp(scale, 1.03, exitProgress)
      blur = Math.max(blur, lerp(0, 6, exitProgress))
    }
    return { opacity: clamp01(opacity), scale, blur }
  }

  // 正常模式：提前一点开始淡入，这样行不会在 startTime 那一帧突然出现。
  const preEnter = Math.min(0.1, enterDuration * 0.35)
  const enterProgress = easeOutCubic(
    clamp01(
      (timeSec - (line.startTime - preEnter)) / (enterDuration + preEnter)
    )
  )
  let opacity = enterProgress
  let scale = lerp(0.9, 1, enterProgress)
  let blur = lerp(10, 0, enterProgress)
  const exitStart = Math.max(linePassStart, lineEndTime - exitDuration)
  const exitProgress = easeOutCubic(
    clamp01((timeSec - exitStart) / exitDuration)
  )
  if (exitProgress > 0) {
    opacity *= 1 - exitProgress
    scale = lerp(scale, 1.1, exitProgress)
    blur = Math.max(blur, lerp(0, 20, exitProgress))
  }
  return { opacity: clamp01(opacity), scale, blur }
}

/** 唱完之后的漂移进度：5 秒走完一个 easeInOut。 */
export function cadenzaPassedDrift(timeSec: number, word: Word): number {
  if (timeSec <= word.endTime) return 0
  return easeInOutQuad(clamp01((timeSec - word.endTime) / 5))
}
