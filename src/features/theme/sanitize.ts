import type {
  DualTheme,
  Theme,
  ThemeAnimationIntensity,
  ThemeFontStyle,
} from './model'

// 主题净化与兜底：取色失败、持久化数据损坏或字段非法时都退回这里的默认值。
// 从 Folia themeSanitizer.ts 移植；兜底色换成 SOEI tokens.css 的实际配色。
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const FALLBACK_LIGHT_THEME: Theme = {
  name: '素墨白昼',
  backgroundColor: '#f2f2ea',
  primaryColor: '#1a211f',
  accentColor: '#2d6683',
  secondaryColor: '#4b534e',
  fontStyle: 'serif',
  animationIntensity: 'normal',
  wordColors: [],
  lyricsIcons: [],
  provider: 'SOEI',
}

// 点缀色沿用 tokens.css 的 --color-ambient-default，
// 这样「没有在播放」时的氛围光束与移植前完全一致。
const FALLBACK_DARK_THEME: Theme = {
  name: '素墨子夜',
  backgroundColor: '#050809',
  primaryColor: '#f2f2ea',
  accentColor: '#7cacc8',
  secondaryColor: '#a8ada4',
  fontStyle: 'serif',
  animationIntensity: 'normal',
  wordColors: [],
  lyricsIcons: [],
  provider: 'SOEI',
}

export const FALLBACK_DUAL_THEME: DualTheme = {
  light: FALLBACK_LIGHT_THEME,
  dark: FALLBACK_DARK_THEME,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function normalizeHexColorCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!HEX_COLOR_PATTERN.test(trimmed)) return null
  const hex = trimmed.slice(1).toLowerCase()
  if (hex.length === 3)
    return `#${hex
      .split('')
      .map(character => `${character}${character}`)
      .join('')}`
  return `#${hex}`
}

export const normalizeThemeHexColor = (
  value: unknown,
  fallback: string,
  hardFallback = '#ffffff'
): string =>
  normalizeHexColorCandidate(value) ??
  normalizeHexColorCandidate(fallback) ??
  hardFallback

const normalizeFontStyle = (
  value: unknown,
  fallback: ThemeFontStyle
): ThemeFontStyle =>
  value === 'serif' || value === 'mono' || value === 'sans' ? value : fallback

const normalizeAnimationIntensity = (
  value: unknown,
  fallback: ThemeAnimationIntensity
): ThemeAnimationIntensity =>
  value === 'calm' || value === 'chaotic' || value === 'normal'
    ? value
    : fallback

function normalizeWordColors(
  value: unknown,
  fallbackColor: string
): NonNullable<Theme['wordColors']> {
  if (!Array.isArray(value)) return []
  return value.flatMap(entry => {
    if (!isRecord(entry)) return []
    const word = typeof entry.word === 'string' ? entry.word.trim() : ''
    if (!word) return []
    return [{ word, color: normalizeThemeHexColor(entry.color, fallbackColor) }]
  })
}

function normalizeLyricsIcons(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((icon): icon is string => typeof icon === 'string')
    .map(icon => icon.trim())
    .filter(Boolean)
    .slice(0, 12)
}

export function sanitizeTheme(value: unknown, fallbackTheme: Theme): Theme {
  const source = isRecord(value) ? value : {}
  const accentColor = normalizeThemeHexColor(
    source.accentColor,
    fallbackTheme.accentColor
  )
  return {
    ...fallbackTheme,
    name:
      typeof source.name === 'string' && source.name.trim()
        ? source.name.trim()
        : fallbackTheme.name,
    description:
      typeof source.description === 'string'
        ? source.description.trim()
        : fallbackTheme.description,
    backgroundColor: normalizeThemeHexColor(
      source.backgroundColor,
      fallbackTheme.backgroundColor
    ),
    primaryColor: normalizeThemeHexColor(
      source.primaryColor,
      fallbackTheme.primaryColor
    ),
    accentColor,
    secondaryColor: normalizeThemeHexColor(
      source.secondaryColor,
      fallbackTheme.secondaryColor
    ),
    fontStyle: normalizeFontStyle(source.fontStyle, fallbackTheme.fontStyle),
    animationIntensity: normalizeAnimationIntensity(
      source.animationIntensity,
      fallbackTheme.animationIntensity
    ),
    wordColors:
      source.wordColors === undefined
        ? fallbackTheme.wordColors
        : normalizeWordColors(source.wordColors, accentColor),
    lyricsIcons:
      source.lyricsIcons === undefined
        ? fallbackTheme.lyricsIcons
        : normalizeLyricsIcons(source.lyricsIcons),
    provider:
      typeof source.provider === 'string' && source.provider.trim()
        ? source.provider.trim()
        : fallbackTheme.provider,
  }
}

export function sanitizeDualTheme(
  value: unknown,
  fallbackTheme: DualTheme = FALLBACK_DUAL_THEME
): DualTheme {
  const source = isRecord(value) ? value : {}
  return {
    light: sanitizeTheme(source.light, fallbackTheme.light),
    dark: sanitizeTheme(source.dark, fallbackTheme.dark),
  }
}
