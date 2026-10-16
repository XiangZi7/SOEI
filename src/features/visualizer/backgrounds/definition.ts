import type { Component } from 'vue'
import type { Theme } from '../../theme/model'
import type { AudioBands } from '../audioBands'
import type { ReadableValue } from '../timeSource'

// 可发现的背景模式契约。从 Folia backgrounds/definition.ts 移植。
//
// 与上游的差别：
//   - `MotionValue<number>` → `ReadableValue<number>`（见 timeSource.ts）
//   - `render: (props) => ReactNode` → Vue 组件，并与模式注册表一样走异步加载
//   - 上游把每个背景的 tuning 与 actions 各列一组可选字段（definition.ts 里 6 个模式
//     共 80 行的嵌套回调），SOEI 收成一个按模式 id 索引的 `tunings` 记录 + 一个
//     `update` 回调，和 visualizer 模式的 `tunings` 保持同一形状

export interface VisualizerBackgroundProps {
  theme: Theme
  isDaylight?: boolean
  coverUrl?: string | null
  audioPower: ReadableValue<number>
  audioBands: AudioBands
  /** 分镜种子。同一个种子必须给出同一套布局。 */
  seed?: string | number
  /** 静态模式：不跑动画，用于预览图与省电档。 */
  staticMode?: boolean
  paused?: boolean
  /** 由画质档控制 DOM 动画的最高帧率。 */
  frameRate?: number
  /** 各背景的调参，按模式 id 索引。 */
  tunings?: Record<string, unknown>
}

export interface VisualizerBackgroundRegistryEntry {
  mode: string
  /** 排序用；选择器按它排列。 */
  order: number
  label: string
  description: string
  /**
   * renderer 必须是异步组件，原因与模式注册表相同（见 ../definition.ts）：
   * entry 若静态 import renderer，任何碰到背景设置的模块都会连带把全部背景拉进 bundle。
   */
  component: Component
}

export const defineVisualizerBackground = (
  entry: VisualizerBackgroundRegistryEntry
) => entry
