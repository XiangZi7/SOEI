import type { Line, Word } from '../../lyrics/folia/model'
import {
  getLineRenderEndTime,
  getLineRenderHints,
  type LineRenderHints,
  type LineTransitionMode,
  type WordRevealMode,
} from '../../lyrics/folia/renderHints'
import type { Theme } from '../../theme/model'
import {
  resolveThemeFontStack,
  resolveThemeFontWeight,
} from '../../theme/fontStacks'

// classic（Luminous）的纯布局与时序。从 Folia classic/Visualizer.tsx 抽出，
// 与 Vue 组件分离，便于单测。
//
// 上游注释称它是整个目录里最直白的歌词流水线，也是其他模式反复借用时序思路的「基线」：
// 先问 runtime 现在哪一行活跃，再读那一行的 renderHints，然后给每个词算一份松散布局，
// 使每个词都能独立动画而不依赖父级重渲染。
//
// 一行歌词里，词基本走三个状态：
//   waiting —— 还没唱到，保持较轻的预备姿态
//   active  —— 正在唱，主发光/本体/涟漪都在这里驱动
//   passed  —— 已唱过，留一点余晖和漂移，免得整行死得太突然

export interface ClassicTuning {
  enableWordRotation: boolean
  breathingFloatMultiplier: number
  useLegacyLayout: boolean
  wordSpacing: number
}

export const DEFAULT_CLASSIC_TUNING: ClassicTuning = {
  enableWordRotation: true,
  breathingFloatMultiplier: 1,
  useLegacyLayout: false,
  wordSpacing: 0.7,
}

const clampBreathing = (value: number) => Math.min(2, Math.max(0, value))
const clampWordSpacing = (value: number) => Math.min(2, Math.max(0, value))

export function resolveClassicTuning(tuning?: unknown): ClassicTuning {
  const input = tuning && typeof tuning === 'object' ? tuning : {}
  const number = (key: 'breathingFloatMultiplier' | 'wordSpacing') => {
    const value =
      key === 'breathingFloatMultiplier'
        ? 'breathingFloatMultiplier' in input
          ? input.breathingFloatMultiplier
          : undefined
        : 'wordSpacing' in input
          ? input.wordSpacing
          : undefined
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : DEFAULT_CLASSIC_TUNING[key]
  }
  return {
    enableWordRotation:
      'enableWordRotation' in input &&
      typeof input.enableWordRotation === 'boolean'
        ? input.enableWordRotation
        : DEFAULT_CLASSIC_TUNING.enableWordRotation,
    breathingFloatMultiplier: clampBreathing(
      number('breathingFloatMultiplier')
    ),
    useLegacyLayout:
      'useLegacyLayout' in input && typeof input.useLegacyLayout === 'boolean'
        ? input.useLegacyLayout
        : DEFAULT_CLASSIC_TUNING.useLegacyLayout,
    wordSpacing: clampWordSpacing(number('wordSpacing')),
  }
}

export interface ClassicLineRenderProfile {
  renderHints: LineRenderHints | null
  lineRenderEndTime: number
  lineTransitionMode: LineTransitionMode
  wordRevealMode: WordRevealMode
  wordLookahead: number
}

/**
 * renderHints 来自歌词流水线，不是 visualizer 自己算的；
 * 这里只是把它重新打包成逐帧更好消费的形状。
 */
export function resolveClassicLineRenderProfile(
  line: Line | null | undefined
): ClassicLineRenderProfile | null {
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

export function getClassicWordActiveEndTime(
  word: Word,
  profile: ClassicLineRenderProfile
): number {
  if (profile.wordRevealMode === 'instant') return profile.lineRenderEndTime
  if (profile.wordRevealMode === 'fast')
    return Math.min(
      profile.lineRenderEndTime,
      Math.max(word.endTime, word.startTime + 0.12)
    )
  return word.endTime
}

export function getClassicWordDisplayDuration(
  word: Word,
  profile: ClassicLineRenderProfile
): number {
  const activeEndTime = getClassicWordActiveEndTime(word, profile)
  const minDuration =
    profile.wordRevealMode === 'instant'
      ? 0.08
      : profile.wordRevealMode === 'fast'
        ? 0.12
        : 0.1
  return Math.max(activeEndTime - word.startTime, minDuration)
}

export type ClassicWordStatus = 'waiting' | 'active' | 'passed'

/**
 * 按绝对播放时间求词的状态。上游在 framer 的 useMotionValueEvent 里做同样的判断；
 * 抽成纯函数后既可单测，也能在 rAF 里直接调用。
 */
export function classicWordStatus(
  timeSec: number,
  word: Word,
  profile: ClassicLineRenderProfile
): ClassicWordStatus {
  const activeEndTime = getClassicWordActiveEndTime(word, profile)
  if (
    timeSec >= word.startTime - profile.wordLookahead &&
    timeSec <= activeEndTime
  )
    return 'active'
  if (timeSec > activeEndTime) return 'passed'
  return 'waiting'
}

export interface ClassicLineConfig {
  justifyContent: string
  alignItems: string
  perspective: number
}

export interface ClassicWordConfig {
  id: string
  x: number
  y: number
  rotate: number
  scale: number
  marginRight: string
  alignSelf: string
  passedRotate: number
}

let measureCanvas: HTMLCanvasElement | null = null

/** 用 2D canvas 量一个词的宽度；没有 DOM 时按字数估算。 */
export function measureWordWidth(
  text: string,
  pxSize: number,
  fontStack: string,
  fontWeight: number
): number {
  if (typeof document === 'undefined') return text.length * pxSize * 0.65
  measureCanvas ??= document.createElement('canvas')
  const context = measureCanvas.getContext('2d')
  if (!context) return text.length * pxSize * 0.65
  context.font = `${fontWeight} ${pxSize}px ${fontStack}`
  return context.measureText(text).width
}

/** 上游的 clamp(2.25rem, 6vw, 4.5rem) 换算成像素，用于排版测量。 */
export function classicPixelFontSize(
  fontScale: number,
  viewportWidth: number
): number {
  const rem = 16
  return Math.max(
    2.25 * fontScale * rem,
    Math.min((6 * fontScale * viewportWidth) / 100, 4.5 * fontScale * rem)
  )
}

const JUSTIFY_CALM = ['center']
const JUSTIFY_OPTIONS = [
  'flex-start',
  'center',
  'flex-end',
  'space-around',
  'space-between',
]
const ALIGN_CALM = ['center']
const ALIGN_OPTIONS = ['flex-start', 'center', 'flex-end']

export interface ClassicLayoutInput {
  line: Line
  words: Word[]
  theme: Theme
  tuning: ClassicTuning
  lyricsFontScale: number
  viewportWidth: number
  seed?: string | number
}

/**
 * 为当前行生成稳定的随机布局。**种子取行的开始时间**，所以同一句歌词
 * 不会在每次重渲染时重新洗牌 —— 时间应该改变动画状态，而不是基础几何。
 */
export function buildClassicLayout({
  line,
  words,
  theme,
  tuning,
  lyricsFontScale,
  viewportWidth,
  seed: sceneSeed,
}: ClassicLayoutInput): {
  lineConfig: ClassicLineConfig
  wordConfigs: ClassicWordConfig[]
} {
  // 默认保留上游按行起始时间生成的布局；SOEI 的「换个分镜」加一个稳定种子偏移。
  let offset = 0
  if (sceneSeed !== undefined && String(sceneSeed) !== '0') {
    let hash = 2166136261
    for (const char of String(sceneSeed))
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    offset = (hash >>> 0) % 100000
  }
  const seed = line.startTime + offset
  const intensity = theme.animationIntensity
  const isChaotic = intensity === 'chaotic'
  const isCalm = intensity === 'calm'
  const isInterlude = line.fullText === '......'

  const justifyOptions = isCalm ? JUSTIFY_CALM : JUSTIFY_OPTIONS
  const alignOptions = isCalm ? ALIGN_CALM : ALIGN_OPTIONS
  const lineConfig: ClassicLineConfig = {
    justifyContent: isInterlude
      ? 'center'
      : justifyOptions[Math.floor(seed % justifyOptions.length)]!,
    alignItems: alignOptions[Math.floor((seed * 2) % alignOptions.length)]!,
    perspective: isChaotic ? 500 + (seed % 500) : 1000,
  }

  const fontStack = resolveThemeFontStack(theme)
  const fontWeight = resolveThemeFontWeight(theme, 700)
  const pxFontSize = classicPixelFontSize(lyricsFontScale, viewportWidth)
  const wordWidths = words.map(word =>
    measureWordWidth(word.text, pxFontSize, fontStack, fontWeight)
  )

  const baseSpread = isChaotic ? 60 : isCalm ? 0 : 20
  const baseRotate = isChaotic ? 30 : isCalm ? 0 : 5

  // 每个词一个可复现的小 RNG，所以偏移量稳定。
  const randomAt = (wordSeed: number) => (offset: number) => {
    const value = Math.sin(wordSeed + offset) * 10000
    return value - Math.floor(value)
  }
  const configScaleAt = (random: (offset: number) => number) =>
    isChaotic ? 0.8 + random(4) * 0.6 : 1.1 + random(4) * 0.2

  const wordConfigs = words.map((word, index) => {
    const random = randomAt(seed + index)
    if (isInterlude)
      return {
        id: `${word.text}-${index}-${seed}`,
        x: 0,
        // 轻微的竖向随机。
        y: (random(2) - 0.5) * 15,
        rotate: 0,
        scale: 1.5,
        marginRight: '3rem',
        alignSelf: 'center',
        passedRotate: 0,
      }

    const scale = configScaleAt(random)
    const x = (random(1) - 0.5) * baseSpread * 2
    const y = (random(2) - 0.5) * baseSpread * 2
    let marginRight = isChaotic ? `${random(5) * 1.5}rem` : '0.8rem'

    if (!tuning.useLegacyLayout) {
      // 精确算右边距，避免缩放与位移时视觉重叠。
      const width = wordWidths[index] ?? 0
      // active 态的最大缩放倍率。
      const activeScale = scale * 1.4
      let nextWidth = 0
      let nextActiveScale = 1
      let nextX = 0
      if (index + 1 < words.length) {
        const nextRandom = randomAt(seed + index + 1)
        nextActiveScale = configScaleAt(nextRandom) * 1.4
        nextX = (nextRandom(1) - 0.5) * baseSpread * 2
        nextWidth = wordWidths[index + 1] ?? 0
      }
      const gap = 0.05 * pxFontSize
      const halfOverflow = (width * (activeScale - 1)) / 2
      const nextHalfOverflow = (nextWidth * (nextActiveScale - 1)) / 2
      const calculated =
        (halfOverflow + nextHalfOverflow + (x - nextX) + gap) *
        tuning.wordSpacing
      const minMargin =
        (isChaotic ? 0.08 * pxFontSize : 0.12 * pxFontSize) * tuning.wordSpacing
      marginRight = `${Math.max(minMargin, calculated).toFixed(1)}px`
    }

    return {
      id: `${word.text}-${index}-${seed}`,
      x,
      y,
      rotate: tuning.enableWordRotation
        ? (random(3) - 0.5) * baseRotate * 2
        : 0,
      scale,
      marginRight,
      alignSelf:
        isChaotic && random(6) > 0.7
          ? random(7) > 0.5
            ? 'flex-start'
            : 'flex-end'
          : 'auto',
      passedRotate: tuning.enableWordRotation ? (random(8) - 0.5) * 45 : 0,
    }
  })

  return { lineConfig, wordConfigs }
}

/** 整行的呼吸浮动，让屏幕在词事件之间不会完全静止。返回 null 表示关闭。 */
export function classicBreathing(
  tuning: ClassicTuning,
  intensity: Theme['animationIntensity']
): { distancePx: number; durationSec: number; scaleAmount: number } | null {
  const multiplier = tuning.breathingFloatMultiplier
  if (multiplier <= 0) return null
  const byIntensity = {
    calm: { distance: 10, duration: 8.5 },
    normal: { distance: 14, duration: 7 },
    chaotic: { distance: 18, duration: 5.8 },
  } as const
  const { distance, duration } = byIntensity[intensity]
  return {
    distancePx: distance * multiplier,
    durationSec: duration,
    scaleAmount: 0.01 * multiplier,
  }
}
