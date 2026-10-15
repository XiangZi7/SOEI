// Adapted from Folia cadenza/VisualizerCadenza.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { colorWithAlpha, mixColors } from '../../theme/colorMath'
import type { Theme } from '../../theme/model'
import { clamp01, lerp } from '../easing'
import type { CadenzaPlacement } from './cadenzaLayout'
import {
  CADENZA_ACTIVE_PULSE_FREQUENCY,
  cadenzaBodyMix,
  cadenzaCharGlow,
  cadenzaGlowEnvelope,
  cadenzaPassedDrift,
  cadenzaWordProgress,
  cadenzaWordStatus,
  type CadenzaLineTiming,
  type CadenzaWordStatus,
} from './cadenzaTiming'

// cadenza 的逐帧求值。
//
// 这里是整个移植里唯一**保留了帧间状态**的地方：上游让每个 placement 用
// `1 - exp(-k·dt)` 的指数跟随器追向目标，词滑入位置的手感完全来自这个跟随。
// 纯绝对时间求值做不到这件事 —— 三态切换会变成硬跳。
//
// 但跟随器是有历史的，这与 SOEI「Seek 落在正确的帧」的约定冲突。
// 折中：正常播放时跟随，检测到时间跳变（回拖、跨行跳转、暂停后恢复）时直接落位。
// 这样观感保住了，Seek 之后第一帧就是正确结果，不会看到一段补演的动画。

/** 跟随速率（1/s）。位置/旋转/缩放一档，透明度/模糊一档，发光最快。 */
const TRANSFORM_FOLLOW_RATE = 11
const VISUAL_FOLLOW_RATE = 14
const GLOW_FOLLOW_RATE = 16
/** 时间跳变阈值（秒）：超过这个量就认为是 Seek 而不是连续播放。 */
const SEEK_THRESHOLD_SECONDS = 0.35

export interface CadenzaPlacementState {
  x: number
  y: number
  rotation: number
  scale: number
  bodyAlpha: number
  blur: number
  activeMix: number
  glowAlpha: number
}

export interface CadenzaPlacementTarget extends CadenzaPlacementState {
  status: CadenzaWordStatus
  progress: number
}

export interface CadenzaTargetInput {
  placement: CadenzaPlacement
  /** 本 placement 在排序后的下标，用于错开浮动相位。 */
  placementIndex: number
  timeSec: number
  timing: CadenzaLineTiming
  theme: Theme
  stageWidth: number
  /** 聚焦基线的屏幕纵坐标（已含整行的呼吸起伏）。 */
  focusY: number
  motionEnergy: number
  staticMode: boolean
}

/** 目标状态：完全由绝对时间决定，不含任何帧间历史。 */
export function cadenzaPlacementTarget(
  input: CadenzaTargetInput
): CadenzaPlacementTarget {
  const {
    placement,
    placementIndex,
    timeSec,
    timing,
    theme,
    stageWidth,
    focusY,
    motionEnergy,
    staticMode,
  } = input
  const status = cadenzaWordStatus(timeSec, timing, placement.word)
  const progress = cadenzaWordProgress(
    timeSec,
    timing.wordRevealMode,
    placement.word
  )
  const isInstant = timing.wordRevealMode === 'instant'

  if (staticMode)
    return {
      status,
      progress,
      x: stageWidth / 2 + placement.x,
      y: focusY + placement.y,
      rotation: 0,
      scale: placement.scale,
      bodyAlpha: 1,
      blur: 0,
      activeMix: 0,
      glowAlpha: 0,
    }

  const passedAlpha = isInstant
    ? 0
    : theme.animationIntensity === 'chaotic'
      ? 0.9
      : 0.82
  // 活跃词的轻微脉动。相位按词的起始时刻错开，整行不会同步呼吸。
  const pulse =
    status === 'active' && !isInstant
      ? 1 +
        Math.sin(
          timeSec * CADENZA_ACTIVE_PULSE_FREQUENCY +
            placement.word.startTime * 5
        ) *
          0.04 *
          (motionEnergy || 1)
      : 1
  const driftProgress = isInstant
    ? 0
    : cadenzaPassedDrift(timeSec, placement.word)

  const scale =
    status === 'waiting'
      ? isInstant
        ? placement.scale
        : Math.max(placement.scale * 0.5, 0.5)
      : status === 'active'
        ? isInstant
          ? placement.scale
          : placement.scale * 1.3 * pulse
        : placement.scale
  // 上游 placement.rotate 恒为 0，所以等待态的 20° 与过气态的 passedRotate
  // 都是围绕 0 展开的；这里直接按 0 写死，不保留那个永远为零的字段。
  const rotation =
    status === 'waiting'
      ? isInstant
        ? 0
        : 20
      : status === 'passed'
        ? isInstant
          ? 0
          : placement.passedRotate * driftProgress
        : 0

  const floatX =
    Math.sin(timeSec * 1.2 + placementIndex * 0.6) * motionEnergy * 4
  const floatY =
    Math.cos(timeSec * 1.5 + placementIndex * 0.4) * motionEnergy * 2.5
  const driftX =
    status === 'passed' ? placement.passedDriftX * driftProgress : 0
  const driftY =
    status === 'passed' ? placement.passedDriftY * driftProgress : 0

  return {
    status,
    progress,
    x: stageWidth / 2 + placement.x + floatX + driftX,
    y: focusY + placement.y + floatY + driftY,
    rotation,
    scale,
    bodyAlpha: status === 'waiting' ? 0 : status === 'active' ? 1 : passedAlpha,
    blur: status === 'waiting' && !isInstant ? 10 : 0,
    activeMix: cadenzaBodyMix(timeSec, timing, placement.word),
    glowAlpha: cadenzaGlowEnvelope(timeSec, timing, placement.word),
  }
}

/**
 * 指数跟随：把当前状态推向目标。`deltaSec` 是本帧的实际间隔，
 * 所以掉帧时收敛速度不变（这正是上游用 `1 - exp(-k·dt)` 而不是固定系数的原因）。
 */
export function followCadenzaState(
  state: CadenzaPlacementState,
  target: CadenzaPlacementTarget,
  deltaSec: number
): void {
  const transform = 1 - Math.exp(-TRANSFORM_FOLLOW_RATE * deltaSec)
  const visual = 1 - Math.exp(-VISUAL_FOLLOW_RATE * deltaSec)
  const glow = 1 - Math.exp(-GLOW_FOLLOW_RATE * deltaSec)
  state.x = lerp(state.x, target.x, transform)
  state.y = lerp(state.y, target.y, transform)
  state.rotation = lerp(state.rotation, target.rotation, transform)
  state.scale = lerp(state.scale, target.scale, transform)
  state.bodyAlpha = lerp(state.bodyAlpha, target.bodyAlpha, visual)
  state.blur = lerp(state.blur, target.blur, visual)
  state.activeMix = lerp(state.activeMix, target.activeMix, visual)
  state.glowAlpha = lerp(state.glowAlpha, target.glowAlpha, glow)
}

/** 直接落位，用于首次出现与 Seek 之后。 */
export function snapCadenzaState(
  state: CadenzaPlacementState,
  target: CadenzaPlacementTarget
): void {
  state.x = target.x
  state.y = target.y
  state.rotation = target.rotation
  state.scale = target.scale
  state.bodyAlpha = target.bodyAlpha
  state.blur = target.blur
  state.activeMix = target.activeMix
  state.glowAlpha = target.glowAlpha
}

/**
 * 新出现的 placement 的初始状态。
 * `instant` 模式下如果该词已经开始了，直接按目标初始化 ——
 * 否则跳到一句的中间会看到整行重新滑入。
 */
export function initialCadenzaState(
  placement: CadenzaPlacement,
  target: CadenzaPlacementTarget,
  timeSec: number,
  isInstant: boolean
): CadenzaPlacementState {
  if (isInstant && timeSec >= placement.word.startTime) return { ...target }
  return {
    x: target.x,
    y: target.y,
    rotation: target.rotation + 16,
    scale: Math.max(placement.scale * 0.5, 0.5),
    bodyAlpha: 0,
    blur: 10,
    activeMix: 0,
    glowAlpha: 0,
  }
}

/** 时间跳变检测。回拖或大步前进都按 Seek 处理。 */
export function isCadenzaSeek(
  previousTimeSec: number | null,
  timeSec: number
): boolean {
  if (previousTimeSec === null) return true
  return Math.abs(timeSec - previousTimeSec) > SEEK_THRESHOLD_SECONDS
}

/**
 * 发光 filter。上游用三层 `text-shadow`（40px，透明度 0.98/0.92/0.35）
 * 画在一个透明文字的独立图层上；这里换成 `drop-shadow` 链直接施加在正文上。
 * 原因与 `wordGlow.ts` 记录的一致：每帧变化的 text-shadow 半径会铸造无界的字形
 * strike，在 Linux 上耗尽渲染进程的 fd。drop-shadow 由合成器整层施加，不经字形缓存。
 *
 * `drop-shadow` 投影的是被绘制内容的 alpha，所以透明文字的发光层不再可行 ——
 * 这也是为什么不保留上游的双层结构。
 */
export function cadenzaGlowFilter(
  color: string,
  intensity: number,
  blurScale = 1
): string {
  const glow = Math.max(0, Math.min(intensity, 1.6))
  if (glow <= 0.01) return 'none'
  // 40px text-shadow 的等效 drop-shadow 半径（与 wordGlow.ts 同一套拟合系数）。
  const radius = 40 * 0.4 * blurScale
  return (
    `drop-shadow(0 0 ${(radius * 0.5).toFixed(2)}px ${colorWithAlpha(color, Math.min(0.98, glow) * 0.7)}) ` +
    `drop-shadow(0 0 ${radius.toFixed(2)}px ${colorWithAlpha(color, Math.min(0.92, glow * 0.92))}) ` +
    `drop-shadow(0 0 ${(radius * 1.45).toFixed(2)}px ${colorWithAlpha(color, Math.min(0.35, glow * 0.26))})`
  )
}

/** 逐字发光强度。`splitGlow` 为 false 时整片段用同一个词级包络。 */
export function cadenzaGraphemeGlow(
  placement: CadenzaPlacement,
  graphemeIndex: number,
  timeSec: number,
  timing: CadenzaLineTiming,
  glowAlpha: number,
  glowIntensity: number
): number {
  const gate = clamp01(glowAlpha) * Math.max(glowIntensity, 0)
  if (gate <= 0) return 0
  if (!placement.splitGlow)
    return cadenzaGlowEnvelope(timeSec, timing, placement.word) * gate
  return (
    cadenzaCharGlow(
      timeSec,
      placement.word,
      placement.fragmentStartInWord + graphemeIndex,
      Math.max(placement.wordGraphemeCount, placement.graphemes.length),
      placement.wordGraphemeTimings
    ) * gate
  )
}

export interface CadenzaRipple {
  /** 直径（px）。 */
  size: number
  opacity: number
  color: string
}

/** 副歌时活跃词周围的扩散圆环。间奏行不做。 */
export function cadenzaRipple(
  placement: CadenzaPlacement,
  target: CadenzaPlacementTarget,
  state: CadenzaPlacementState,
  isChorus: boolean
): CadenzaRipple | null {
  if (!isChorus || target.status !== 'active' || placement.isInterlude)
    return null
  const visualWidth = placement.width * state.scale
  const visualHeight = placement.height * state.scale * 1.08
  const radius =
    Math.max(visualWidth, visualHeight) * (0.55 + target.progress * 0.45)
  const opacity = 0.45 * (1 - target.progress) * state.bodyAlpha
  if (opacity <= 0.005 || radius <= 0) return null
  return { size: radius * 2, opacity, color: placement.color }
}

/** 正文颜色：主色混到该词的高亮色。 */
export function cadenzaBodyColor(
  theme: Theme,
  placement: CadenzaPlacement,
  activeMix: number
): string {
  return mixColors(theme.primaryColor, placement.color, activeMix)
}
