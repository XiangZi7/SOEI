import type { VisualizerRegistryEntry } from './definition'

// 模式注册表。沿用上游的自动发现：每个模式在 `<mode>/entry.ts` 里 export default 一个
// defineVisualizer(...)，这里用 Vite 的 eager glob 扫出来，新增模式不需要改这个文件。
//
// 注意 entry 必须保持轻量（只有元数据 + defineAsyncComponent），真正的 renderer 走异步，
// 原因见 definition.ts 的说明。
const modules = import.meta.glob<{ default: VisualizerRegistryEntry }>(
  './*/entry.ts',
  { eager: true }
)

const entries: VisualizerRegistryEntry[] = Object.values(modules)
  .map(module => module.default)
  .filter((entry): entry is VisualizerRegistryEntry => Boolean(entry?.mode))
  .sort((a, b) => a.order - b.order || a.mode.localeCompare(b.mode))

const byMode = new Map(entries.map(entry => [entry.mode, entry]))

/** 已注册的模式，按 order 排序。 */
export const visualizerEntries = (): readonly VisualizerRegistryEntry[] =>
  entries

/** 按 id 取模式；未注册时返回 undefined，调用方据此回落到 SOEI 原有的 CSS 场景。 */
export const visualizerEntry = (
  mode: string | undefined
): VisualizerRegistryEntry | undefined =>
  mode === undefined ? undefined : byMode.get(mode)

export const hasVisualizer = (mode: string | undefined): boolean =>
  mode !== undefined && byMode.has(mode)
