import type { PaletteTone } from './paletteAnalysis'
import type { ThemeMode } from './model'

// 主题的数值设计空间：每种色调的背景有多深/多染色，以及各角色在对比度求解前的
// 饱和度/亮度起始带。从 Folia themeColorRanges.ts 移植。
export type Range = [number, number]

export interface BackgroundTone {
  darkLightness: Range
  darkSaturation: Range
  lightLightness: Range
  lightSaturation: Range
}

export const PRIMARY_MIN_CONTRAST = 9
export const ACCENT_MIN_CONTRAST = 3.2
export const SECONDARY_MIN_CONTRAST = 4.5
export const MIN_BACKGROUND_SATURATION = 0.04

// 背景性格：主题从接近中性的墨色，到完全染色的底，能走多远。
export const BACKGROUND_TONES: Record<PaletteTone, BackgroundTone> = {
  ink: {
    darkLightness: [0.055, 0.085],
    darkSaturation: [0.1, 0.22],
    lightLightness: [0.94, 0.965],
    lightSaturation: [0.05, 0.12],
  },
  tinted: {
    darkLightness: [0.075, 0.11],
    darkSaturation: [0.2, 0.36],
    lightLightness: [0.92, 0.95],
    lightSaturation: [0.1, 0.2],
  },
  rich: {
    darkLightness: [0.095, 0.14],
    darkSaturation: [0.32, 0.5],
    lightLightness: [0.9, 0.935],
    lightSaturation: [0.18, 0.3],
  },
}

// 刻意避开纯 #ffffff / #000000 两极，并朝背景色相染色
// （暗色下是柔和奶白/淡薄荷，亮色下是深海军蓝/李子色）。
export const PRIMARY_RANGES: Record<
  ThemeMode,
  { saturation: Range; lightness: Range }
> = {
  light: { saturation: [0.15, 0.4], lightness: [0.1, 0.2] },
  dark: { saturation: [0.1, 0.3], lightness: [0.9, 0.96] },
}

export const ACCENT_RANGES: Record<
  ThemeMode,
  { saturation: Range; lightness: Range }
> = {
  light: { saturation: [0.55, 0.88], lightness: [0.38, 0.55] },
  dark: { saturation: [0.55, 0.92], lightness: [0.55, 0.72] },
}

export const SECONDARY_RANGES: Record<
  ThemeMode,
  { saturation: Range; lightness: Range }
> = {
  light: { saturation: [0.15, 0.45], lightness: [0.32, 0.46] },
  dark: { saturation: [0.15, 0.45], lightness: [0.62, 0.76] },
}
