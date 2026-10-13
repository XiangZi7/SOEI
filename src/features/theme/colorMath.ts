// 色彩数学：hex/rgb/hsl 互转、WCAG 亮度与对比度，以及保留色相把颜色推过对比度下限的求解器。
// 从 Folia 的 colorMix.ts 与 themeColorMath.ts 合并而来，纯函数、无 DOM 依赖。
export interface Rgb {
  r: number
  g: number
  b: number
}
export interface Hsl {
  h: number
  s: number
  l: number
}

const FALLBACK_THEME_COLOR = '#4f7cff'
const FALLBACK_RGB: Rgb = { r: 255, g: 255, b: 255 }

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount

const isFiniteChannel = (value: number) => Number.isFinite(value)

export const normalizeHue = (hue: number) => ((hue % 360) + 360) % 360

export function parseColorChannels(color: string): Rgb | null {
  const normalized = typeof color === 'string' ? color.trim() : ''
  if (!normalized) return null
  if (normalized.startsWith('#')) {
    const hex = normalized.slice(1)
    const parse = (value: string) => Number.parseInt(value, 16)
    if (/^[0-9a-f]{3}$/i.test(hex))
      return {
        r: parse(hex[0] + hex[0]),
        g: parse(hex[1] + hex[1]),
        b: parse(hex[2] + hex[2]),
      }
    if (/^[0-9a-f]{6}$/i.test(hex))
      return {
        r: parse(hex.slice(0, 2)),
        g: parse(hex.slice(2, 4)),
        b: parse(hex.slice(4, 6)),
      }
    return null
  }
  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/)
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1]
      .split(',')
      .slice(0, 3)
      .map(part => Number.parseFloat(part.trim()))
    if ([r, g, b].every(isFiniteChannel)) return { r, g, b }
  }
  return null
}

const formatRgba = ({ r, g, b }: Rgb, alpha: number) =>
  `rgba(${clampChannel(r)}, ${clampChannel(g)}, ${clampChannel(b)}, ${alpha})`

export function colorWithAlpha(color: string, alpha: number): string {
  const normalizedAlpha = clamp(alpha, 0, 1)
  const channels = parseColorChannels(color)
  if (channels) return formatRgba(channels, normalizedAlpha)
  // 非 hex / rgb 的合法 CSS 颜色（如 currentColor）原样返回，空值退回白色。
  const normalized = typeof color === 'string' ? color.trim() : ''
  return normalized ? normalized : formatRgba(FALLBACK_RGB, normalizedAlpha)
}

export function mixColors(
  from: string,
  to: string,
  amount: number,
  alpha = 1
): string {
  const ratio = clamp01(amount)
  const start = parseColorChannels(from)
  const end = parseColorChannels(to)
  if (!start || !end) return colorWithAlpha(ratio >= 0.5 ? to : from, alpha)
  return formatRgba(
    {
      r: mix(start.r, end.r, ratio),
      g: mix(start.g, end.g, ratio),
      b: mix(start.b, end.b, ratio),
    },
    clamp(alpha, 0, 1)
  )
}

export const parseThemeColor = (value: string): Rgb | null => {
  const channels = parseColorChannels(value)
  if (!channels) return null
  return {
    r: clampChannel(channels.r),
    g: clampChannel(channels.g),
    b: clampChannel(channels.b),
  }
}

export const rgbToHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map(channel => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = clampChannel(r) / 255
  const green = clampChannel(g) / 255
  const blue = clampChannel(b) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  const lightness = (max + min) / 2
  if (delta === 0) return { h: 0, s: 0, l: lightness }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  const hue =
    max === red
      ? ((green - blue) / delta) % 6
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4
  return {
    h: normalizeHue(hue * 60),
    s: clamp01(saturation),
    l: clamp01(lightness),
  }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = normalizeHue(h)
  const saturation = clamp01(s)
  const lightness = clamp01(l)
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const offset = lightness - chroma / 2
  const sector = Math.floor(hue / 60) % 6
  const [r, g, b] =
    sector === 0
      ? [chroma, secondary, 0]
      : sector === 1
        ? [secondary, chroma, 0]
        : sector === 2
          ? [0, chroma, secondary]
          : sector === 3
            ? [0, secondary, chroma]
            : sector === 4
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary]
  return {
    r: clampChannel((r + offset) * 255),
    g: clampChannel((g + offset) * 255),
    b: clampChannel((b + offset) * 255),
  }
}

export const hexToHsl = (color: string): Hsl | null => {
  const parsed = parseThemeColor(color)
  return parsed ? rgbToHsl(parsed) : null
}

export const hslToHex = (hsl: Hsl) => rgbToHex(hslToRgb(hsl))

// 线性 RGB 混合并保持在 hex 空间；Theme 的颜色字段只接受 hex。
export function mixHexColors(from: string, to: string, amount: number): string {
  const start = parseThemeColor(from)
  const end = parseThemeColor(to)
  if (!start || !end)
    return rgbToHex(
      parseThemeColor(to) ??
        parseThemeColor(from) ??
        parseThemeColor(FALLBACK_THEME_COLOR)!
    )
  const ratio = clamp01(amount)
  return rgbToHex({
    r: mix(start.r, end.r, ratio),
    g: mix(start.g, end.g, ratio),
    b: mix(start.b, end.b, ratio),
  })
}

export function getRelativeLuminance(color: string): number {
  const parsed = parseThemeColor(color)
  if (!parsed) return 0
  const transform = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  }
  return (
    0.2126 * transform(parsed.r) +
    0.7152 * transform(parsed.g) +
    0.0722 * transform(parsed.b)
  )
}

export function getContrastRatio(
  foreground: string,
  background: string
): number {
  const luminanceA = getRelativeLuminance(foreground)
  const luminanceB = getRelativeLuminance(background)
  const [lighter, darker] =
    luminanceA > luminanceB
      ? [luminanceA, luminanceB]
      : [luminanceB, luminanceA]
  return (lighter + 0.05) / (darker + 0.05)
}

export function getHueDistance(a: number, b: number): number {
  const distance = Math.abs(normalizeHue(a) - normalizeHue(b))
  return Math.min(distance, 360 - distance)
}

// 沿亮度轴远离背景走，直到满足对比度下限，色相与饱和度保持不变。
// 下限不可达时返回对比度最好的候选色，而不是换成硬编码的兜底色。
export function adjustLightnessForContrast(
  color: string,
  background: string,
  minRatio: number,
  step = 0.02,
  maxSteps = 50
): string {
  const hsl = hexToHsl(color)
  if (!hsl) return color
  const direction = getRelativeLuminance(background) > 0.35 ? -1 : 1
  let bestColor = hslToHex(hsl)
  let bestRatio = getContrastRatio(bestColor, background)
  for (let index = 0; index <= maxSteps; index += 1) {
    const lightness = clamp01(hsl.l + direction * step * index)
    const candidate = hslToHex({ ...hsl, l: lightness })
    const ratio = getContrastRatio(candidate, background)
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestColor = candidate
    }
    if (ratio >= minRatio) return candidate
    // 亮度轴已经顶到端点，继续走没有意义。
    if (index > 0 && (lightness === 0 || lightness === 1)) break
  }
  return bestColor
}
