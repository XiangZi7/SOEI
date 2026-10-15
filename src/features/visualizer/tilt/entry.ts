import { defineAsyncComponent } from 'vue'
import { defineVisualizer } from '../definition'

// entry 保持轻量：只有元数据 + 异步 renderer。
export default defineVisualizer({
  mode: 'tilt',
  order: 70,
  label: '错落',
  description: '概率分行 · 斜体错位',
  previewSeed: 'tilt',
  previewStartOffset: 0,
  component: defineAsyncComponent(() => import('./VisualizerTilt.vue')),
})
