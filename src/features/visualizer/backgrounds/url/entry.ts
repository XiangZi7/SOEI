import { defineAsyncComponent } from 'vue'
import { defineVisualizerBackground } from '../definition'
export default defineVisualizerBackground({
  mode: 'url',
  order: 60,
  label: '网页',
  description: '自定义网页背景',
  component: defineAsyncComponent(() => import('./UrlBackground.vue')),
})
