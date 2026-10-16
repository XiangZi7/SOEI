// Adapted from Folia backgrounds/common/GeometricBackground.tsx (AGPL-3.0);
// see third_party/Folia-NOTICE.md.
import { seededRandom } from '../../../theme/generateTheme'

// 几何背景的场景生成。
//
// 与上游的差别：上游在 `useMemo(..., [seed])` 里调 `Math.random()`，
// 所以 seed 只是「重新摇一次」的信号，同一个 seed 并不会给出同一套布局。
// SOEI 的「换个分镜」与预览图都要求可复现，所以改成用 seed 驱动 mulberry32。

export type GeometricShapeType =
  'circle' | 'square' | 'triangle' | 'cross' | 'icon'

/** 形状跟随哪个频段缩放。 */
export type GeometricBandKey =
  'bass' | 'lowMid' | 'mid' | 'vocal' | 'treble' | 'power'

export interface GeometricShape {
  id: number
  type: GeometricShapeType
  /** `icon` 类型才有；其余为 null。 */
  iconName: string | null
  /** 位置按百分比。 */
  x: number
  y: number
  size: number
  durationSec: number
  delaySec: number
  opacity: number
  /** 漂浮方向取反，让相邻形状不同步。 */
  reverse: boolean
  /** 实心还是描边。只对 circle/square 有意义。 */
  filled: boolean
  rotation: number
  band: GeometricBandKey
}

export interface GeometricParticle {
  id: number
  size: number
  x: number
  y: number
  opacity: number
  durationSec: number
  delaySec: number
}

export interface GeometricScene {
  shapes: GeometricShape[]
  particles: GeometricParticle[]
}

export const GEOMETRIC_SHAPE_COUNT = 15
export const GEOMETRIC_PARTICLE_COUNT = 20
/** 图标形状的上限。超过这个数画面会从「几何」变成「贴纸」。 */
export const GEOMETRIC_MAX_ICON_SHAPES = 6

const PLAIN_SHAPE_TYPES: Exclude<GeometricShapeType, 'icon'>[] = [
  'circle',
  'square',
  'triangle',
  'cross',
]

/** 形状类型到频段的固定映射：不同形状对不同频率起舞。 */
export function geometricShapeBand(type: GeometricShapeType): GeometricBandKey {
  switch (type) {
    case 'circle':
      return 'bass'
    case 'square':
      return 'lowMid'
    case 'triangle':
      return 'mid'
    case 'cross':
      return 'treble'
    case 'icon':
      return 'vocal'
    default:
      return 'power'
  }
}

export function geometricClipPath(type: GeometricShapeType): string {
  if (type === 'triangle') return 'polygon(50% 0%, 0% 100%, 100% 100%)'
  if (type === 'cross')
    return (
      'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, ' +
      '80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)'
    )
  return 'none'
}

/**
 * 频段能量到形状缩放。
 *
 * 上游的输入域是 `[10, 200]`（0..255 量级的原始值），输出 `[0.95, 1.45]`。
 * SOEI 的频段已经归一化到 0..1，所以先还原到 255 量级再套同一个映射，
 * 这样观感与上游一致而不是凭空换一套曲线。
 */
export function geometricShapeScale(normalized: number): number {
  const raw = Math.max(
    10,
    Math.min(Number.isFinite(normalized) ? normalized * 255 : 0, 200)
  )
  return 0.95 + ((raw - 10) / 190) * 0.5
}

/**
 * 生成一套场景。`availableIcons` 是调用方已经过滤过的、确实能渲染的图标名 ——
 * 传进来而不是在这里查表，是为了让这个模块保持纯函数、可单测。
 */
export function buildGeometricScene(
  seed: string | number | undefined,
  availableIcons: readonly string[] = []
): GeometricScene {
  const random = seededRandom(String(seed ?? 'default'))
  const shapes: GeometricShape[] = []
  let iconCount = 0

  for (let index = 0; index < GEOMETRIC_SHAPE_COUNT; index += 1) {
    const wantIcon = availableIcons.length > 0 && random() > 0.7
    const useIcon = wantIcon && iconCount < GEOMETRIC_MAX_ICON_SHAPES
    if (useIcon) iconCount += 1
    const type: GeometricShapeType = useIcon
      ? 'icon'
      : PLAIN_SHAPE_TYPES[Math.floor(random() * PLAIN_SHAPE_TYPES.length)]!
    shapes.push({
      id: index,
      type,
      iconName: useIcon
        ? availableIcons[Math.floor(random() * availableIcons.length)]!
        : null,
      x: random() * 100,
      y: random() * 100,
      size: 40 + random() * 100,
      // 图标转得比几何形状快一些。
      durationSec: useIcon ? 20 + random() * 20 : 30 + random() * 30,
      delaySec: random() * 5,
      opacity: 0.11 + random() * 0.08,
      reverse: random() > 0.5,
      filled: random() < 0.3,
      rotation: random() * 360,
      band: geometricShapeBand(type),
    })
  }

  const particles: GeometricParticle[] = []
  for (let index = 0; index < GEOMETRIC_PARTICLE_COUNT; index += 1)
    particles.push({
      id: index,
      size: random() * 4 + 1,
      x: random() * 100,
      y: random() * 100,
      opacity: random() * 0.3,
      durationSec: 15 + random() * 20,
      delaySec: random() * 10,
    })

  return { shapes, particles }
}
