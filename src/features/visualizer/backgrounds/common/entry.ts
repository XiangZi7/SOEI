import { defineAsyncComponent } from 'vue'
import { defineVisualizerBackground } from '../definition'
export default defineVisualizerBackground({
  mode: 'common',
  order: 10,
  label: '流体几何',
  description: '封面色彩与音频几何',
  component: defineAsyncComponent(() => import('./CommonBackground.vue')),
})
