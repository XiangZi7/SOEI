import { defineAsyncComponent } from 'vue'
import { defineVisualizer } from '../definition'
export default defineVisualizer({
  mode: 'monet',
  order: 100,
  label: '印象',
  description: '封面海报 · 逐词扫光',
  previewSeed: 'monet',
  previewStartOffset: 0,
  usesWordSegmentation: true,
  component: defineAsyncComponent(() => import('./VisualizerMonet.vue')),
})
