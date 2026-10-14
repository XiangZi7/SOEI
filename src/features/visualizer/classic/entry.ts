import { defineAsyncComponent } from 'vue'
import { defineVisualizer } from '../definition'

export default defineVisualizer({
  mode: 'classic',
  order: 30,
  label: '辉光',
  description: '逐词辉光 · 呼吸排版',
  previewSeed: 'classic',
  previewStartOffset: 0,
  usesWordSegmentation: true,
  component: defineAsyncComponent(() => import('./VisualizerClassic.vue')),
})
