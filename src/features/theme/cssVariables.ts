import type { Theme } from './model'
import { colorWithAlpha, mixHexColors } from './colorMath'

// Theme → CSS 自定义属性。这是封面取色贯通全局的唯一出口：
// 侧栏高亮、播放条进度、氛围光束、发光描边都只读这些变量，不各自算色。
export type ThemeVariables = Record<string, string>

export function themeVariables(theme: Theme): ThemeVariables {
  const { backgroundColor, primaryColor, secondaryColor, accentColor } = theme
  return {
    '--theme-background': backgroundColor,
    '--theme-primary': primaryColor,
    '--theme-secondary': secondaryColor,
    '--theme-accent': accentColor,
    // 面板与悬停底：把点缀色压进背景，避免直接用半透明白造成的发灰。
    '--theme-surface': mixHexColors(backgroundColor, accentColor, 0.07),
    '--theme-surface-strong': mixHexColors(backgroundColor, accentColor, 0.14),
    // 描边与分隔线。
    '--theme-line': colorWithAlpha(primaryColor, 0.14),
    '--theme-line-strong': colorWithAlpha(primaryColor, 0.26),
    // 发光：进度条光晕、Now Playing 边框、歌词高亮共用。
    '--theme-glow': colorWithAlpha(accentColor, 0.45),
    '--theme-glow-soft': colorWithAlpha(accentColor, 0.18),
    // 兼容 SOEI 已有的氛围层与歌词舞台变量，使它们自动跟随封面。
    '--ambient-color': accentColor,
    '--stage-color': accentColor,
  }
}

/** 把变量写到元素上（通常是 documentElement），便于全局继承。 */
export function applyThemeVariables(element: HTMLElement, theme: Theme): void {
  const variables = themeVariables(theme)
  for (const [name, value] of Object.entries(variables))
    element.style.setProperty(name, value)
}

export function clearThemeVariables(element: HTMLElement, theme: Theme): void {
  for (const name of Object.keys(themeVariables(theme)))
    element.style.removeProperty(name)
}
