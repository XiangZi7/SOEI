import { getHueDistance, hexToHsl, normalizeHue, type Hsl } from './colorMath'

// 读取封面的代表色，决定主题的色彩骨架：哪个色相主导、哪个色相点缀、背景该多饱和多深。
// 从 Folia coverPaletteAnalysis.ts 移植。
export type HarmonyScheme =
  'analogous' | 'complementary' | 'split' | 'triadic' | 'duotone' | 'monochrome'

export type PaletteTone = 'ink' | 'tinted' | 'rich'

export interface CoverPalette {
  baseHue: number
  baseSaturation: number
  baseLightness: number
  accentHue: number
  scheme: HarmonyScheme
  tone: PaletteTone
}

const MIN_SUPPORT_SATURATION = 0.15
const MIN_SUPPORT_HUE_DISTANCE = 25
const MAX_SUPPORT_HUE_DISTANCE = 160
const MONOCHROME_SATURATION_CEILING = 0.18

// 偏好同时具备饱和度与中等亮度的颜色：它们承载封面的身份，
// 而接近纯黑/纯白的像素只描述它的底色。
const getCoverColorScore = ({ s, l }: Hsl) =>
  s * Math.max(0, 1 - Math.abs(l - 0.5) * 1.2)

function pickWeighted<T>(
  random: () => number,
  entries: { value: T; weight: number }[]
): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let cursor = random() * total
  for (const entry of entries) {
    cursor -= entry.weight
    if (cursor <= 0) return entry.value
  }
  return entries[entries.length - 1].value
}

function pickBaseColor(parsedColors: Hsl[], random: () => number): Hsl {
  // 没有封面可读：直接抽一个色相，让无封面的歌曲每次也有变化。
  if (parsedColors.length === 0)
    return { h: random() * 360, s: 0.35 + random() * 0.3, l: 0.5 }
  const scored = parsedColors.reduce(
    (best, candidate) =>
      getCoverColorScore(candidate) > getCoverColorScore(best)
        ? candidate
        : best,
    parsedColors[0]
  )
  return getCoverColorScore(scored) > 0.02 ? scored : parsedColors[0]
}

function pickSupportHue(parsedColors: Hsl[], base: Hsl): number | null {
  const support = parsedColors.find(candidate => {
    if (candidate.s < MIN_SUPPORT_SATURATION) return false
    const distance = getHueDistance(candidate.h, base.h)
    return (
      distance >= MIN_SUPPORT_HUE_DISTANCE &&
      distance <= MAX_SUPPORT_HUE_DISTANCE
    )
  })
  return support ? support.h : null
}

function pickScheme(
  baseSaturation: number,
  supportHue: number | null,
  random: () => number
): HarmonyScheme {
  // 封面上真实存在的第二个色相，是最「出自这张封面」的点缀色。
  if (supportHue !== null && random() < 0.65) return 'duotone'
  return pickWeighted<HarmonyScheme>(random, [
    { value: 'analogous', weight: 3 },
    { value: 'complementary', weight: 2 },
    { value: 'split', weight: 2 },
    { value: 'triadic', weight: 1.5 },
    {
      value: 'monochrome',
      weight: baseSaturation < MONOCHROME_SATURATION_CEILING ? 2.5 : 0,
    },
  ])
}

function resolveAccentHue(
  scheme: HarmonyScheme,
  baseHue: number,
  supportHue: number | null,
  random: () => number
): number {
  const sign = random() < 0.5 ? -1 : 1
  switch (scheme) {
    case 'duotone':
      return supportHue ?? baseHue
    case 'analogous':
      return baseHue + sign * (20 + random() * 15)
    case 'complementary':
      return baseHue + 150 + random() * 30
    case 'split':
      return baseHue + (sign < 0 ? 150 : 210)
    case 'triadic':
      return baseHue + sign * 120
    case 'monochrome':
    default:
      return baseHue
  }
}

/** 把封面的原始色板变成主题生成器依赖的色相/色调契约。 */
export function analyzeCoverPalette(
  coverColors: string[],
  random: () => number
): CoverPalette {
  const parsedColors = coverColors
    .map(color => hexToHsl(color))
    .filter((color): color is Hsl => color !== null)
  const base = pickBaseColor(parsedColors, random)
  const supportHue = pickSupportHue(parsedColors, base)
  const scheme = pickScheme(base.s, supportHue, random)
  const accentJitter = scheme === 'monochrome' ? 0 : (random() - 0.5) * 16
  return {
    baseHue: normalizeHue(base.h),
    baseSaturation: base.s,
    baseLightness: base.l,
    accentHue: normalizeHue(
      resolveAccentHue(scheme, base.h, supportHue, random) + accentJitter
    ),
    scheme,
    tone: pickWeighted<PaletteTone>(random, [
      { value: 'ink', weight: 3 },
      { value: 'tinted', weight: 4 },
      { value: 'rich', weight: 2.5 },
    ]),
  }
}
