<script setup lang="ts">
// Adapted from Folia backgrounds/VisualizerBackgroundRenderer.tsx (AGPL-3.0);
// see third_party/Folia-NOTICE.md.
import { computed } from 'vue'
import type { VisualizerBackgroundProps } from './definition'
import { visualizerBackgroundEntry } from './registry'

// 按 mode 从背景注册表取 entry 并渲染。`transparent` 时整层不挂东西 ——
// 壁纸模式与 OBS 抠像需要真正的透明，而不是一层接近黑的底色。
const props = defineProps<{
  mode?: string | null
  transparent?: boolean
  shared: VisualizerBackgroundProps
}>()

const entry = computed(() =>
  props.transparent
    ? undefined
    : visualizerBackgroundEntry(props.mode ?? undefined)
)
</script>

<template>
  <!-- entry.component 是异步组件；Suspense 边界由此处提供，fallback 留空以免背景闪白。 -->
  <Suspense v-if="entry">
    <component
      :is="entry.component"
      v-bind="shared"
    />
    <template #fallback>
      <div />
    </template>
  </Suspense>
</template>
