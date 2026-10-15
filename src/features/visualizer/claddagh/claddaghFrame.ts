// Adapted from Folia claddagh/VisualizerCladdagh.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import type { Theme } from '../../theme/model'
import { colorWithAlpha, mixColors } from '../../theme/colorMath'
import { clamp01 } from '../easing'
import {
  getVisualLength,
  normalizeReadableAngle,
  type CladdaghSpacingItem,
} from './claddaghGeometry'

// 伪 3D 椭圆环的逐字投影。全部按绝对时间求值，Seek 直接落到正确画面。
//
// 发光用链式 drop-shadow 而不是 text-shadow：字形每帧都在 scale()，
// 即使半径取整到整像素，到 Chromium 的字形缓存那里仍是无界的设备尺寸集合，
// 每一个都会泄漏共享内存（同 wordGlow.ts 记录的那条 Linux fd 泄漏）。
// filter 由合成器施加，永不经过字形缓存。
//
// 上游按像素差拟合出的系数：单层匹配 text-shadow 半径的一半
// （text-shadow 的半径是两个 sigma，drop-shadow 是一个）；
// 副歌的三层用 0.4 倍，且中间层明显更弱 —— 因为每个 drop-shadow 也会给它前面那层投影。
const GLOW_DROP_SHADOW_SCALE = 0.5
const CHORUS_DROP_SHADOW_SCALE = 0.4
const CHORUS_MIDDLE_ALPHA = 0.2

export function buildCladdaghGlowFilter(
  color: string,
  coreColor: string,
  radius: number,
  glyphAlpha: number,
  fade: number,
  isChorus: boolean
): string {
  // drop-shadow 投影的是已经带着 glyphAlpha 的字形，所以阴影色只承载
  // text-shadow 在那之上多出的部分。
  const glow = (alpha: number) => colorWithAlpha(color, alpha)
  if (!isChorus)
    return `drop-shadow(0 0 ${(radius * GLOW_DROP_SHADOW_SCALE).toFixed(2)}px ${glow(fade)})`
  const scale = CHORUS_DROP_SHADOW_SCALE
  const core = mixColors(
    color,
    coreColor,
    0.65,
    clamp01(fade / Math.max(glyphAlpha, 0.01))
  )
  return (
    `drop-shadow(0 0 ${(radius * 0.35 * scale).toFixed(2)}px ${core}) ` +
    `drop-shadow(0 0 ${(radius * scale).toFixed(2)}px ${glow(fade * CHORUS_MIDDLE_ALPHA)}) ` +
    `drop-shadow(0 0 ${(radius * 1.6 * scale).toFixed(2)}px ${glow(fade)})`
  )
}

/** 音频能量归一化。主播放器给 0..255，预览给 0..1，所以按首次见到的量级判断。 */
export function createPowerNormalizer(): (power: number) => number {
  let rawScale = false
  return power => {
    if (!Number.isFinite(power)) return 0
    if (power > 1) rawScale = true
    return clamp01(rawScale ? power / 255 : power)
  }
}

/** 按动效强度决定音频对半径的影响幅度与上限。 */
export function claddaghRadiusPulse(
  intensity: Theme['animationIntensity'],
  power: number
): number {
  const multiplier =
    intensity === 'calm' ? 0.08 : intensity === 'chaotic' ? 0.95 : 0.25
  const maxScale =
    intensity === 'calm' ? 1.08 : intensity === 'chaotic' ? 1.95 : 1.25
  return Math.min(1 + power * multiplier, maxScale)
}

/**
 * 长句之间的重叠缓解：当前行很长时，让后续行更淡更小。
 * 只对 centerLineIndex 之后的行生效。
 */
export function claddaghLengthMitigation(
  currentText: string | undefined,
  targetText: string | undefined,
  lineDiffFromCenter: number,
  isAfterCenter: boolean
): { fade: number; scale: number } {
  const currentLength = currentText ? getVisualLength(currentText) : 0
  if (!isAfterCenter || currentLength <= 10) return { fade: 1, scale: 1 }
  const targetLength = targetText ? getVisualLength(targetText) : 0
  const fadeStrength = clamp01((currentLength - 10) / 8)
  const targetStrength = Math.max(0.4, Math.min(1, (targetLength - 5) / 5))
  const combined = fadeStrength * targetStrength
  const progress = clamp01((lineDiffFromCenter - 0.4) / 0.5)
  return {
    fade: 1 - combined * progress,
    scale: 1 - combined * 0.25 * progress,
  }
}

export interface CladdaghCharFrame {
  transform: string
  opacity: number
  color: string
  filter: string
}

export interface CladdaghCharInput {
  item: CladdaghSpacingItem
  /** 该字素在本行中的序号，用于副歌的上下交替。 */
  charIndex: number
  timeSec: number
  /** 环当前的整体旋转量（弧度）。 */
  lineOffset: number
  /** 本行自身的字内偏移 + 背面跟随量。 */
  wordOffset: number
  lineIndex: number
  centerLineIndex: number
  rx: number
  ry: number
  fontPx: number
  theme: Theme
  tiltDeg: number
  focusScaleRatio: number
  power: number
  isChorus: boolean
  /** 下一行提前入场的进度 0..1；非后续行为 0。 */
  upcomingEntry: number
  lengthFade: number
  lengthScale: number
  baseColor: string
  highlightColor: string
}

/**
 * 单个字素的一帧。
 *
 * 几何：字素按标称角度排在椭圆上，长轴 R_major = rx，短轴只有 rx 的 9%（细长的环）。
 * 深度因子 D 由 cos(thetaCurve) 得出（正面 1、背面 0），同时驱动字距收拢、
 * 缩放、模糊与透明度，从而在纯 2D 里得到伪 3D 观感。
 */
export function claddaghCharFrame(input: CladdaghCharInput): CladdaghCharFrame {
  const {
    item,
    charIndex,
    timeSec,
    lineOffset,
    wordOffset,
    lineIndex,
    centerLineIndex,
    rx,
    fontPx,
    theme,
    tiltDeg,
    focusScaleRatio,
    power,
    isChorus,
    upcomingEntry,
    lengthFade,
    lengthScale,
    baseColor,
    highlightColor,
  } = input

  // 行与行之间相隔 180 度。
  const theta = lineIndex * Math.PI + item.nominalAngle
  const psi = theta - lineOffset - wordOffset
  const deltaDist = psi * rx
  const thetaCurve = deltaDist / rx
  const localCos = Math.cos(thetaCurve)
  const depth = (localCos + 1) / 2
  // 背面的字按深度收拢，显得更远。
  const spacingFactor = 0.35 + 0.65 * depth ** 1.2
  const rawX = Math.sin(thetaCurve) * rx * spacingFactor
  // 短轴压扁成 9%，所以环是细长的。
  let rawY = localCos * (rx * 0.09)
  if (isChorus) {
    // 副歌时奇偶字上下交错，幅度随节拍能量脉动。
    const stagger = fontPx * (0.06 + power * 0.12)
    rawY += (charIndex % 2 === 0 ? 1 : -1) * stagger
  }

  // 把坐标系整体转 -tiltDeg，让长轴对齐屏幕的反对角线。
  const thetaRot = (-tiltDeg * Math.PI) / 180
  const cosTheta = Math.cos(thetaRot)
  const sinTheta = Math.sin(thetaRot)
  const x = rawX * cosTheta - rawY * sinTheta
  const y = rawX * sinTheta + rawY * cosTheta

  const tangentX = Math.cos(thetaCurve) * rx
  const tangentY = -Math.sin(thetaCurve) * (rx * 0.09)
  const tangentAngle = normalizeReadableAngle(
    (Math.atan2(
      tangentX * sinTheta + tangentY * cosTheta,
      tangentX * cosTheta - tangentY * sinTheta
    ) *
      180) /
      Math.PI
  )

  const lineDiff = Math.abs(lineOffset - lineIndex * Math.PI) / Math.PI
  const activeLineFactor = Math.max(0, 1 - lineDiff)
  // 聚焦宽度：只有距正前方 48% 半径以内的字算「在焦点上」。
  const distRatio = Math.min(1, Math.abs(deltaDist) / (rx * 0.48))
  const focus = activeLineFactor * (1 - distRatio) ** 1.8

  const distanceOpacity = 0.68 + 0.32 * depth ** 1.9
  let opacity =
    (0.35 + 0.65 * depth ** 1.5 * (0.35 + 0.65 * focus)) * distanceOpacity
  // 下一行还等同于上一行的正面转身时先藏着。
  opacity *= clamp01(2 - lineDiff)
  // 已经过去的行在转场完成后完全隐藏，避免背面叠字。
  if (lineIndex < centerLineIndex) opacity *= Math.max(0, 1 - lineDiff)
  opacity *= lengthFade
  if (lineIndex > centerLineIndex) opacity *= 0.18 + 0.82 * upcomingEntry

  // 边界淡出：把非聚焦行严格压在椭圆的后半。
  if (lineDiff > 0.02) {
    const progress = clamp01((lineDiff - 0.3) / 0.6)
    const threshold = 1 - 1.2 * progress
    if (localCos > threshold)
      opacity *= clamp01(1 - (localCos - threshold) / 0.15)
  }

  const scale =
    (0.22 + 0.98 * depth ** 1.5) *
    (1 + focusScaleRatio * focus) *
    lengthScale *
    (item.scaleFactor || 1)
  const blur = 8 * (1 - depth) * (1 - 0.5 * focus)
  const tiltAngle = Math.max(
    -38,
    Math.min(38, tangentAngle * (0.4 + 0.6 * depth))
  )

  // 字的演唱进度决定颜色与一次快速衰减的「闪光」。
  let charProgress = 0
  if (timeSec >= item.endTime) charProgress = 1
  else if (timeSec > item.startTime) {
    const duration = item.endTime - item.startTime
    charProgress = duration > 0 ? (timeSec - item.startTime) / duration : 1
  }

  const baseGlow = isChorus ? (36 + power * 24) * focus ** 1.5 : 24 * focus ** 2
  const finalHighlight = item.charColor || highlightColor
  let color = baseColor
  let alpha = 0.55
  let flashPop = 0
  if (charProgress >= 1) {
    color = finalHighlight
    alpha = 1
  } else if (charProgress > 0) {
    // 颜色几乎是硬切（×15），所以唱到的那一下很明确。
    const progressFactor = Math.min(1, charProgress * 15)
    alpha = 0.55 + 0.45 * progressFactor
    color = mixColors(baseColor, finalHighlight, progressFactor, alpha)
    if (charProgress < 0.4) flashPop = (1 - charProgress / 0.4) ** 2 * 0.65
  }

  const radius = baseGlow * (1 + flashPop)
  // 平滑淡出，避免阴影在 0.5px 阈值处突然消失。
  const shadowFade = clamp01((radius - 0.5) / 2)
  const glowFilter =
    radius > 0.5 && shadowFade > 0.01
      ? buildCladdaghGlowFilter(
          color,
          theme.primaryColor || '#ffffff',
          radius,
          alpha,
          shadowFade,
          isChorus
        )
      : ''
  const blurFilter = blur < 0.2 ? '' : `blur(${blur.toFixed(2)}px)`

  return {
    transform:
      `translate3d(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px), 0px) ` +
      `rotate(${tiltAngle.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
    opacity: clamp01(opacity),
    color,
    filter: [glowFilter, blurFilter].filter(Boolean).join(' ') || 'none',
  }
}

export interface CladdaghAxisFrame {
  background: string
  transform: string
  filter: string
}

/**
 * 中轴线：颜色随低频/人声能量在主色与点缀色之间搏动，
 * 长度按低频的平方放大（平方是为了拉开动态范围，不易饱和）。
 *
 * 两端用 linear-gradient 淡出，所以这条短线段不会有硬边。
 */
export function claddaghAxisFrame(
  theme: Theme,
  bassPower: number,
  vocalPower: number,
  tiltDeg: number,
  chorusGlow: number
): CladdaghAxisFrame {
  const from = theme.primaryColor || '#ffffff'
  let to = theme.accentColor || '#ffffff'
  // 主色与点缀色相同时退到次要色，再不行就混白，保证节拍上看得出变化。
  if (to === from && theme.secondaryColor) to = theme.secondaryColor
  if (to === from) to = '#ffffff'
  const colorPower = Math.max(bassPower, vocalPower)
  const ratio = Math.min(1, Math.max(0, colorPower - 0.02) / 0.58)
  const mixed = mixColors(from, to, ratio, 0.2 + 0.75 * ratio)
  const bassSqr = bassPower * bassPower
  const glowSize = (4 + bassPower * 12) * chorusGlow
  return {
    background: `linear-gradient(90deg, transparent, ${mixed} 20%, ${mixed} 80%, transparent)`,
    transform: `translate(-50%, -50%) rotate(${(90 - tiltDeg).toFixed(2)}deg) scale(${(1 + bassSqr * 1.5).toFixed(3)}, ${(1 + bassSqr * 0.5).toFixed(3)})`,
    filter:
      chorusGlow > 0.001
        ? `drop-shadow(0 0 ${glowSize.toFixed(1)}px ${colorWithAlpha(mixed, chorusGlow)})`
        : 'none',
  }
}
