import { defineAsyncComponent } from 'vue'
import { defineVisualizerBackground } from '../definition'
export default defineVisualizerBackground({
  mode: 'latent',
  order: 40,
  label: '潜流',
  description: '网格渐变与节拍像素',
  component: defineAsyncComponent(() => import('./LatentBackground.vue')),
})
