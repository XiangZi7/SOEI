import { defineAsyncComponent } from 'vue'
import { defineVisualizerBackground } from '../definition'
export default defineVisualizerBackground({
  mode: 'nomand',
  order: 30,
  label: '纸境',
  description: '像素、玻璃、纸张、网点与镜头',
  component: defineAsyncComponent(() => import('./NomandBackground.vue')),
})
