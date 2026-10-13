import type { DualTheme, Theme, ThemeMode } from './model'
import {
  adjustLightnessForContrast,
  clamp01,
  getContrastRatio,
  getHueDistance,
  hslToHex,
  normalizeHue,
} from './colorMath'
import { analyzeCoverPalette, type CoverPalette } from './paletteAnalysis'
import { pickThemeDescriptions } from './descriptionTable'
import { pickThemeNames } from './nameTable'
import {
  ACCENT_MIN_CONTRAST,
  ACCENT_RANGES,
  BACKGROUND_TONES,
  MIN_BACKGROUND_SATURATION,
  PRIMARY_MIN_CONTRAST,
  PRIMARY_RANGES,
  SECONDARY_MIN_CONTRAST,
  SECONDARY_RANGES,
  type Range,
} from './colorRanges'

// 从封面自身的色相加上和谐配色方案生成亮/暗主题对，而不是套固定预设；
// 每个文字色都沿亮度轴推到越过对比度下限为止，因此保留色相而不会塌成硬编码的近白/近黑。
// 从 Folia generateBuiltinDualTheme.ts 移植。

/** mulberry32：同一首歌每次得到同一套主题，换歌才换配色。 */
export function seededRandom(seed: string): () => number {
  let state = 0
  for (const character of seed)
    state = (state * 31 + character.charCodeAt(0)) >>> 0
  // 全零种子会让 mulberry32 退化成常量序列。
  state = (state || 0x9e3779b9) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const between = (random: () => number, [min, max]: Range) =>
  min + random() * (max - min)

// 沿较短的弧插值，避免一对基色/点缀色穿过对侧色相。
function lerpHue(from: number, to: number, amount: number): number {
  const delta = ((to - from + 540) % 360) - 180
  return normalizeHue(from + delta * amount)
}

function buildBackgroundColor(
  mode: ThemeMode,
  palette: CoverPalette,
  random: () => number
): string {
  const tone = BACKGROUND_TONES[palette.tone]
  const lightnessRange =
    mode === 'dark' ? tone.darkLightness : tone.lightLightness
  const saturationRange =
    mode === 'dark' ? tone.darkSaturation : tone.lightSaturation
  // 褪色的封面不该逼出褪色的底，但确实应该读起来更安静。
  const coverWeight = 0.55 + 0.45 * clamp01(palette.baseSaturation / 0.7)
  return hslToHex({
    h: palette.baseHue,
    s: Math.max(
      MIN_BACKGROUND_SATURATION,
      between(random, saturationRange) * coverWeight
    ),
    l: between(random, lightnessRange),
  })
}

function buildAccentColor(
  mode: ThemeMode,
  palette: CoverPalette,
  backgroundColor: string,
  primaryColor: string,
  random: () => number
): string {
  const ranges = ACCENT_RANGES[mode]
  const saturation = between(random, ranges.saturation)
  const lightness = between(random, ranges.lightness)
  const accent = adjustLightnessForContrast(
    hslToHex({ h: palette.accentHue, s: saturation, l: lightness }),
    backgroundColor,
    ACCENT_MIN_CONTRAST
  )
  // 单色/类似色方案的点缀色可能正好压在主文字色上，把它转开。
  const collidesWithPrimary =
    getHueDistance(palette.accentHue, palette.baseHue) < 15 &&
    getContrastRatio(accent, primaryColor) < 1.3
  if (!collidesWithPrimary) return accent
  return adjustLightnessForContrast(
    hslToHex({
      h: normalizeHue(palette.accentHue + 40),
      s: saturation,
      l: lightness,
    }),
    backgroundColor,
    ACCENT_MIN_CONTRAST
  )
}

function buildModeTheme(
  mode: ThemeMode,
  palette: CoverPalette,
  random: () => number,
  name: string,
  description: string
): Theme {
  const backgroundColor = buildBackgroundColor(mode, palette, random)
  const primaryRanges = PRIMARY_RANGES[mode]
  const primaryColor = adjustLightnessForContrast(
    hslToHex({
      h: palette.baseHue,
      s: between(random, primaryRanges.saturation),
      l: between(random, primaryRanges.lightness),
    }),
    backgroundColor,
    PRIMARY_MIN_CONTRAST
  )
  const accentColor = buildAccentColor(
    mode,
    palette,
    backgroundColor,
    primaryColor,
    random
  )
  const secondaryRanges = SECONDARY_RANGES[mode]
  const secondaryColor = adjustLightnessForContrast(
    hslToHex({
      h: lerpHue(palette.baseHue, palette.accentHue, 0.2 + random() * 0.4),
      s: between(random, secondaryRanges.saturation),
      l: between(random, secondaryRanges.lightness),
    }),
    backgroundColor,
    SECONDARY_MIN_CONTRAST
  )
  return {
    name,
    description,
    backgroundColor,
    primaryColor,
    accentColor,
    secondaryColor,
    // SOEI 的视觉基调是衬线/明朝体，上游默认 'sans' 不适用。
    fontStyle: 'serif',
    animationIntensity: 'normal',
    wordColors: [],
    lyricsIcons: [],
    provider: 'SOEI',
  }
}

export function generateDualTheme({
  coverColors = [],
  random = Math.random,
}: {
  coverColors?: string[]
  random?: () => number
} = {}): DualTheme {
  const palette = analyzeCoverPalette(coverColors, random)
  const names = pickThemeNames(palette, random)
  const descriptions = pickThemeDescriptions(palette, random)
  return {
    light: buildModeTheme(
      'light',
      palette,
      random,
      names.light,
      descriptions.light
    ),
    dark: buildModeTheme(
      'dark',
      palette,
      random,
      names.dark,
      descriptions.dark
    ),
  }
}
