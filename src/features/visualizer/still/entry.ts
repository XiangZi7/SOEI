import { defineAsyncComponent } from 'vue'
import { defineVisualizer } from '../definition'

// entry 必须保持轻量：只有元数据 + 异步 renderer。
// 静态 import renderer 会让任何碰到 visualizer 注册表的模块把全部模式一起拉进 bundle。
export default defineVisualizer({
  mode: 'still',
  order: 0,
  label: '静止',
  description: '三行歌词 · 零动画',
  previewSeed: 'still',
  previewStartOffset: 0,
  // 刻意不挂背景层，与上游 renderBackground={false} 一致。
  rendersBackground: false,
  component: defineAsyncComponent(() => import('./VisualizerStill.vue')),
})
