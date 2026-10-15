import { defineAsyncComponent } from 'vue'
import { defineVisualizer } from '../definition'

// entry 保持轻量：只有元数据 + 异步 renderer。
export default defineVisualizer({
  mode: 'cadenza',
  order: 90,
  label: '心景',
  description: '重排版散点 · 主角词',
  previewSeed: 'cadenza',
  previewStartOffset: 0,
  component: defineAsyncComponent(() => import('./VisualizerCadenza.vue')),
})
