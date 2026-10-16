import { defineAsyncComponent } from 'vue'
import { defineVisualizerBackground } from '../definition'
export default defineVisualizerBackground({
  mode: 'sora',
  order: 50,
  label: '星空',
  description: '横向流动的辉光星点',
  component: defineAsyncComponent(() => import('./SoraBackground.vue')),
})
