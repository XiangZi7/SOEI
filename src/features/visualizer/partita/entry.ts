import { defineAsyncComponent } from 'vue'
import { defineVisualizer } from '../definition'

// entry 保持轻量：只有元数据 + 异步 renderer。
export default defineVisualizer({
  mode: 'partita',
  order: 50,
  label: '云阶',
  description: '竖列分行 · 导引线',
  previewSeed: 'partita',
  previewStartOffset: 0,
  // 布局原子来自整句分词，所以用户为某首歌保存的分词会改变它的分行。
  usesWordSegmentation: true,
  component: defineAsyncComponent(() => import('./VisualizerPartita.vue')),
})
