// 主题模型：与 Folia 的 Theme / DualTheme 契约保持一致，便于后续 visualizer 模式直接消费。
export type ThemeMode = 'light' | 'dark'

export type ThemeFontStyle = 'sans' | 'serif' | 'mono'

export type ThemeAnimationIntensity = 'calm' | 'normal' | 'chaotic'

export interface Theme {
  name: string
  backgroundColor: string
  primaryColor: string
  accentColor: string
  secondaryColor: string
  fontStyle: ThemeFontStyle
  fontFamily?: string
  fontFamilyStack?: string[]
  fontWeight?: number
  animationIntensity: ThemeAnimationIntensity
  wordColors?: { word: string; color: string }[]
  // 上游 classic / partita 等模式用它装饰歌词，保留字段以便后续模式移植。
  lyricsIcons?: string[]
  provider?: string
  description?: string
}

export interface DualTheme {
  light: Theme
  dark: Theme
}
