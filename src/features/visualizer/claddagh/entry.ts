import { defineAsyncComponent } from 'vue'
import { defineVisualizer } from '../definition'

// entry 保持轻量：只有元数据 + 异步 renderer。
export default defineVisualizer({
  mode: 'claddagh',
  order: 80,
  label: '环场',
  description: '倾斜椭圆环 · 转面发光',
  previewSeed: 'claddagh',
  previewStartOffset: 0,
  component: defineAsyncComponent(() => import('./VisualizerCladdagh.vue')),
})
