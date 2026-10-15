// Adapted from Folia classic/Visualizer.tsx and partita/VisualizerPartita.tsx (AGPL-3.0);
// see third_party/Folia-NOTICE.md.
import type { Line, Word } from '../lyrics/folia/model'
import {
  getLineRenderEndTime,
  getLineRenderHints,
  type LineRenderHints,
  type LineTransitionMode,
  type WordRevealMode,
} from '../lyrics/folia/renderHints'
import type { Theme } from '../theme/model'
import { mixColors } from '../theme/colorMath'
import {
  wordGlowEnvelope,
  wordGlowFilter,
  type WordGlowTiming,
} from './wordGlow'
import { clamp01, lerp, springStep } from './easing'

// 词级揭示：行的时序档案 + waiting/active/passed 三态 + 逐帧求值。
//
// 上游在 classic 与 partita 里把这一整套复制了两份（render profile、active end、
// display duration、layoutVariants、bodyVariants 全部逐字相同）。SOEI 抽成一处，
// 否则两边会各自漂移。chunk 级的结构差异留在各模式自己的文件里。

export interface WordRevealProfile {
  renderHints: LineRenderHints | null
  lineRenderEndTime: number
  lineTransitionMode: LineTransitionMode
  wordRevealMode: WordRevealMode
  /** 为极短行和快速切换保留的预读窗口。 */
  wordLookahead: number
}

/**
 * renderHints 来自歌词流水线，不是 visualizer 自己算的；
 * 这里只是把它重新打包成逐帧更好消费的形状。
 */
export function resolveWordRevealProfile(
  line: Line | null | undefined
): WordRevealProfile | null {
  if (!line) return null
  const renderHints = getLineRenderHints(line)
  const wordRevealMode = renderHints?.wordRevealMode ?? 'normal'
  return {
    renderHints,
    lineRenderEndTime: getLineRenderEndTime(line),
    lineTransitionMode: renderHints?.lineTransitionMode ?? 'normal',
    wordRevealMode,
    wordLookahead:
      wordRevealMode === 'instant'
        ? 0.03
        : wordRevealMode === 'fast'
          ? 0.08
          : 0.15,
  }
}

export function wordActiveEndTime(
  word: Word,
  profile: WordRevealProfile
): number {
  if (profile.wordRevealMode === 'instant') return profile.lineRenderEndTime
  if (profile.wordRevealMode === 'fast')
    return Math.min(
      profile.lineRenderEndTime,
      Math.max(word.endTime, word.startTime + 0.12)
    )
  return word.endTime
}

export function wordDisplayDuration(
  word: Word,
  profile: WordRevealProfile
): number {
  const minDuration =
    profile.wordRevealMode === 'instant'
      ? 0.08
      : profile.wordRevealMode === 'fast'
        ? 0.12
        : 0.1
  return Math.max(
    wordActiveEndTime(word, profile) - word.startTime,
    minDuration
  )
}

export type WordRevealStatus = 'waiting' | 'active' | 'passed'

/**
 * 按绝对播放时间求状态。上游在 framer 的 useMotionValueEvent 里做同样的判断；
 * 抽成纯函数后既可单测，也能在帧循环里直接调用。
 */
export function wordRevealStatus(
  timeSec: number,
  word: Word,
  profile: WordRevealProfile
): WordRevealStatus {
  const activeEnd = wordActiveEndTime(word, profile)
  if (timeSec >= word.startTime - profile.wordLookahead && timeSec <= activeEnd)
    return 'active'
  if (timeSec > activeEnd) return 'passed'
  return 'waiting'
}

/** 词级 transform 配置。各模式只需要给出这几个量，其余由帧函数解释。 */
export interface WordRevealConfig {
  x: number
  y: number
  rotate: number
  scale: number
  passedRotate: number
}

export interface PreparedRevealWord {
  word: Word
  config: WordRevealConfig
  activeColor: string
  graphemes: { char: string; timing: WordGlowTiming }[]
}

const easeOut = (progress: number) => 1 - (1 - clamp01(progress)) ** 3
/**
 * 上游 spring(stiffness=200, damping=20, mass=1) 的解析阶跃响应。
 * 0.7 秒之后钳到 1 —— 指数尾巴理论上无限长，钳位给「已经到位」一个明确边界。
 */
const spring = springStep(200, 20, 1, 0.7)

export interface WordRevealFrame {
  status: WordRevealStatus
  transform: string
  opacity: number
  color: string
  blur: number
  glows: string[]
  rippleScale: number
  rippleOpacity: number
}

/**
 * 词的逐帧状态。`staticMode` 或没有真实词时间（estimated）时直接给完整静态文字 ——
 * 普通 LRC 不该被呈现成有演唱高亮。
 */
export function wordRevealFrame(
  prepared: PreparedRevealWord,
  profile: WordRevealProfile,
  timeSec: number,
  theme: Theme,
  staticMode = false
): WordRevealFrame {
  const { word, config, activeColor } = prepared
  const status = wordRevealStatus(timeSec, word, profile)
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
  const activeEnd = wordActiveEndTime(word, profile)
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
    config.passedRotate * clamp01(passedElapsed / 5)
  const activeOpacity =
    profile.wordRevealMode === 'instant' && elapsed >= 0
      ? 1
      : clamp01(activeElapsed / 0.1)
  const opacity =
    status === 'waiting'
      ? 0
      : lerp(
          activeOpacity,
          theme.animationIntensity === 'chaotic' ? 0.9 : 0.82,
          passed
        )
  const colorArrival = clamp01(
    activeElapsed / wordDisplayDuration(word, profile)
  )
  const colorFadeDuration =
    profile.wordRevealMode === 'instant'
      ? 0.12
      : profile.wordRevealMode === 'fast'
        ? 0.24
        : 0.8
  const colorAmount =
    colorArrival * (1 - clamp01(passedElapsed / colorFadeDuration))
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
  const rippleProgress = clamp01(elapsed / 0.5)
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

export interface LineRevealFrame {
  opacity: number
  transform: string
  filter: string
}

/** 整行容器的进出场。lineTransitionMode 决定时长与模糊量。 */
export function lineRevealFrame(
  profile: WordRevealProfile,
  lineStartTime: number,
  timeSec: number,
  staticMode = false
): LineRevealFrame {
  if (staticMode) return { opacity: 1, transform: 'none', filter: 'none' }
  const mode = profile.lineTransitionMode
  const duration = mode === 'fast' ? 0.16 : mode === 'none' ? 0 : 0.35
  const arrival = duration ? easeOut((timeSec - lineStartTime) / duration) : 1
  const exitDuration = mode === 'normal' ? 0.3 : mode === 'fast' ? 0.16 : 0.12
  const exit = easeOut((timeSec - profile.lineRenderEndTime) / exitDuration)
  const initialScale = mode === 'fast' ? 0.96 : mode === 'none' ? 1 : 0.9
  const blur =
    (mode === 'fast' ? 4 : mode === 'none' ? 0 : 10) * (1 - arrival) +
    (mode === 'normal' ? 20 : 10) * exit
  return {
    opacity:
      lerp(mode === 'fast' ? 0.35 : mode === 'none' ? 1 : 0, 1, arrival) *
      (1 - exit),
    transform:
      'scale(' + (lerp(initialScale, 1, arrival) + 0.1 * exit).toFixed(4) + ')',
    filter: blur < 0.01 ? 'none' : 'blur(' + blur.toFixed(3) + 'px)',
  }
}

/** 整行的呼吸浮动：让屏幕在词事件之间不会完全静止。 */
export function breathingFrame(
  breathing: { distancePx: number; durationSec: number; scaleAmount: number },
  lineStartTime: number,
  timeSec: number
): string {
  const phase =
    (Math.max(0, timeSec - lineStartTime) / breathing.durationSec) * Math.PI * 2
  return (
    'translateY(' +
    (-Math.sin(phase) * breathing.distancePx).toFixed(3) +
    'px) scale(' +
    (1 + Math.sin(phase) * breathing.scaleAmount).toFixed(4) +
    ')'
  )
}
