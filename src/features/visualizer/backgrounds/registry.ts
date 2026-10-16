import type { VisualizerBackgroundRegistryEntry } from './definition'

// 背景注册表。与模式注册表同一套自动发现：每个背景在 `<mode>/entry.ts` 里
// export default 一个 defineVisualizerBackground(...)，新增背景不需要改这个文件。
//
// 上游还有一条 mod 运行时注册通道（appendVisualizerBackgroundEntry /
// removeVisualizerBackgroundEntry，带 `mod:<modId>:<id>` 前缀防止覆盖内置模式），
// SOEI 没有 mod 系统，不做无消费者的空壳。
const modules = import.meta.glob<{
  default: VisualizerBackgroundRegistryEntry
}>('./*/entry.ts', { eager: true })

const entries: VisualizerBackgroundRegistryEntry[] = Object.values(modules)
  .map(module => module.default)
  .filter((entry): entry is VisualizerBackgroundRegistryEntry =>
    Boolean(entry?.mode)
  )
  .sort((a, b) => a.order - b.order || a.mode.localeCompare(b.mode))

const byMode = new Map(entries.map(entry => [entry.mode, entry]))

/** 没有显式选择时的默认背景。 */
export const DEFAULT_VISUALIZER_BACKGROUND = 'common'

/** 已注册的背景，按 order 排序。 */
export const visualizerBackgroundEntries =
  (): readonly VisualizerBackgroundRegistryEntry[] => entries

export const hasVisualizerBackground = (mode: string | undefined): boolean =>
  mode !== undefined && byMode.has(mode)

/**
 * 按 id 取背景。未注册时回落到默认背景而不是返回 undefined ——
 * 背景层永远要有东西，否则舞台会直接露出下面的页面。
 */
export const visualizerBackgroundEntry = (
  mode: string | undefined
): VisualizerBackgroundRegistryEntry | undefined =>
  (mode === undefined ? undefined : byMode.get(mode)) ??
  byMode.get(DEFAULT_VISUALIZER_BACKGROUND)
