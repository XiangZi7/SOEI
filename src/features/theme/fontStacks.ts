import type { Theme, ThemeFontStyle } from './model'

// 字重与字体栈解析。从 Folia fontStacks.ts 移植，但字体栈换成 SOEI 自带的离线字体
// （SOEI Cormorant / SOEI Mincho，见 src/styles/fonts.css 与 tokens.css），
// 不引入上游的「獅尾四季春加糖SC」等未随本项目打包的字体。
//
// 字体测量与最终渲染必须使用同一个 resolveThemeFontWeight 结果，否则逐字扫光会偏移。
export const MIN_FONT_WEIGHT = 100
export const MAX_FONT_WEIGHT = 900
export const FONT_WEIGHT_STEP = 10

export function normalizeFontWeight(fontWeight: unknown): number | null {
  if (typeof fontWeight !== 'number' || !Number.isFinite(fontWeight))
    return null
  const clamped = Math.min(
    MAX_FONT_WEIGHT,
    Math.max(MIN_FONT_WEIGHT, fontWeight)
  )
  return Math.round(clamped / FONT_WEIGHT_STEP) * FONT_WEIGHT_STEP
}

export const resolveThemeFontWeight = (
  theme: Pick<Theme, 'fontWeight'> | null | undefined,
  fallback: number
) => normalizeFontWeight(theme?.fontWeight) ?? fallback

export const BUILTIN_FONT_STACKS: Record<ThemeFontStyle, string> = {
  sans: '"Segoe UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Helvetica Neue", Arial, sans-serif',
  serif:
    '"SOEI Cormorant", "SOEI Mincho", Baskerville, "Iowan Old Style", "Palatino Linotype", "Yu Mincho", "Noto Serif CJK SC", SimSun, serif',
  mono: 'Consolas, "SFMono-Regular", Menlo, Monaco, "Sarasa Mono SC", "Noto Sans Mono CJK SC", monospace',
}

// 译文/字幕用的栈先走系统界面字体，密集小字下比标题衬线更易读。
const TRANSLATION_FONT_STACKS: Record<ThemeFontStyle, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif',
  serif:
    '"SOEI Mincho", "SOEI Cormorant", Georgia, "Times New Roman", "Noto Serif CJK SC", "Yu Mincho", SimSun, serif',
  mono: 'Consolas, "SFMono-Regular", Menlo, "Sarasa Mono SC", "Microsoft YaHei UI", monospace',
}

const CSS_GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
])

const quoteFontFamily = (fontFamily: string) =>
  `"${fontFamily.replace(/["\\]/g, '\\$&')}"`

const normalizeFontFamilyName = (fontFamily: string) =>
  fontFamily
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim()

function formatFontFamily(fontFamily: string): string | null {
  const normalized = normalizeFontFamilyName(fontFamily)
  if (!normalized) return null
  return CSS_GENERIC_FONT_FAMILIES.has(normalized.toLowerCase())
    ? normalized
    : quoteFontFamily(normalized)
}

export function normalizeFontFamilyStack(
  fontFamilies: Array<string | null | undefined> | null | undefined
): string[] {
  const seen = new Set<string>()
  const stack: string[] = []
  fontFamilies?.forEach(fontFamily => {
    const normalized = normalizeFontFamilyName(fontFamily ?? '')
    if (!normalized) return
    const key = normalized.toLocaleLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    stack.push(normalized)
  })
  return stack
}

function buildCustomFontFamilyStack(
  theme: Pick<Theme, 'fontFamily' | 'fontFamilyStack'>
): string[] {
  const candidates: (string | null | undefined)[] = [
    ...(theme.fontFamily ? [theme.fontFamily] : []),
    ...(theme.fontFamilyStack ?? []),
  ]
  if (candidates.length === 0) return []
  return normalizeFontFamilyStack(candidates)
    .map(formatFontFamily)
    .filter((fontFamily): fontFamily is string => Boolean(fontFamily))
}

export const getBuiltinThemeFontStack = (fontStyle: ThemeFontStyle) =>
  BUILTIN_FONT_STACKS[fontStyle] ?? BUILTIN_FONT_STACKS.serif

export function resolveThemeFontStack(
  theme: Pick<Theme, 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>
): string {
  const fallbackStack = getBuiltinThemeFontStack(theme.fontStyle)
  const customFontStack = buildCustomFontFamilyStack(theme)
  if (customFontStack.length === 0) return fallbackStack
  return `${customFontStack.join(', ')}, ${fallbackStack}`
}

export function resolveThemeTranslationFontStack(
  theme: Pick<Theme, 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>
): string {
  const fallbackStack =
    TRANSLATION_FONT_STACKS[theme.fontStyle] ?? TRANSLATION_FONT_STACKS.serif
  const customFontStack = buildCustomFontFamilyStack(theme)
  if (customFontStack.length === 0) return fallbackStack
  return `${customFontStack.join(', ')}, ${fallbackStack}`
}
