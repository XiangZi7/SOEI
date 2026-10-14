import type { Component } from 'vue'
import type { Line, SubtitleContentMode } from '../lyrics/folia/model'
import type { Theme } from '../theme/model'
import type { AudioBands } from './audioBands'
import type { ReadableValue } from './timeSource'

// 可发现的 visualizer 模式的共享契约。从 Folia definition.ts 移植。
// 不要在模式组件里重新声明一套歌词 props —— 契约只有这一处。
//
// 与上游的差别：
//   - `MotionValue<number>` → `ReadableValue<number>`（见 timeSource.ts，保持 .get() 调用形态）
//   - `render: (props) => ReactElement` → Vue 组件
//   - 上游把 14 个模式的 tuning 各列一个 prop；这里收成一个按模式索引的 `tunings` 记录，
//     各模式自己的 tuning 类型随该模式一起落地，避免现在先铺一堆没有消费者的可选 prop。

/** 上游 Line 内部用秒，`currentTime` 也是秒。毫秒只存在于 SOEI 自己的播放层。 */
export interface VisualizerSharedProps {
  currentTime: ReadableValue<number>
  currentLineIndex: number
  lines: Line[]
  theme: Theme
  subtitleTheme?: Theme
  isDaylight?: boolean
  audioPower: ReadableValue<number>
  audioBands: AudioBands
  showText?: boolean
  songTitle?: string | null
  songArtist?: string | null
  songAlbum?: string | null
  coverUrl?: string | null
  seed?: string | number
  /** 静态模式：不跑动画，用于预览图与省电档。 */
  staticMode?: boolean
  backgroundStaticMode?: boolean
  visualizerOpacity?: number
  lyricsFontScale?: number
  subtitleFontScale?: number
  subtitleOverlayOpacity?: number
  subtitleOverlayBackground?: boolean
  subtitleUpcomingLyricsBlur?: boolean
  showHarmonySubtitle?: boolean
  hideTranslationSubtitle?: boolean
  showSubtitleTranslation?: boolean
  subtitleContentMode?: SubtitleContentMode
  /** 由画质档控制 DOM 动画的最高帧率。 */
  frameRate?: number
  paused?: boolean
  isPreviewMode?: boolean
  onBack?: () => void
  /** 点击歌词定位，参数是歌词时间轴上的秒数。 */
  onLyricLineSeek?: (lyricTimeSec: number) => void
  /** 各模式的调参，按模式 id 索引。 */
  tunings?: Record<string, unknown>
}

export interface VisualizerRegistryEntry {
  mode: string
  /** 排序用；选择器按它排列。 */
  order: number
  /** 显示名与一句话描述，沿用 SOEI 场景选择器的呈现方式。 */
  label: string
  description: string
  /**
   * 预览与自动分镜用的种子/起始偏移，沿用上游语义。
   */
  previewSeed: string
  previewStartOffset: number
  /**
   * renderer 必须是异步组件。上游 definition.ts 记录了原因：
   * entry 若静态 import renderer，任何碰到 visualizer 设置的模块都会连带把全部 renderer
   * 拉进 bundle（上游是 183 个模块，含只有 diorama 用的 three.js）。
   */
  component: Component
  /**
   * 是否挂载共享背景层，默认挂。
   *
   * 上游是每个模式自己套 VisualizerShell 并传 `renderBackground`；SOEI 改成由
   * VisualizerRenderer 统一套外壳（少一层重复），所以「这个模式不要背景」的意图
   * 需要在注册表里表达。`still`（静止）就是刻意不挂背景的那个。
   */
  rendersBackground?: boolean
  /**
   * 该模式的布局原子是否来自整句分词（utils/lyrics/wordSegmentation）。
   * 为真时用户为某首歌保存的分词会改变它的画面。字素级的模式不设此项。
   */
  usesWordSegmentation?: boolean
}

export const defineVisualizer = (entry: VisualizerRegistryEntry) => entry
