import { defineAsyncComponent } from 'vue'
import { defineVisualizerBackground } from '../definition'
export default defineVisualizerBackground({
  mode: 'monet',
  order: 20,
  label: '印象',
  description: '封面染色与缓慢漂移',
  component: defineAsyncComponent(() => import('./MonetBackground.vue')),
})
