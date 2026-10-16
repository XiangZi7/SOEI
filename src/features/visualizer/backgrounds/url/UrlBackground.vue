<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import type { VisualizerBackgroundProps } from '../definition'
import { resolveBackgroundTuning, sanitizeBackgroundUrl } from '../tuning'
const props = defineProps<VisualizerBackgroundProps>()
const host = useTemplateRef<HTMLElement>('host')
const { width, height } = useElementSize(host)
const url = computed(() =>
  sanitizeBackgroundUrl(resolveBackgroundTuning('url', props.tunings?.url).url)
)
</script>
<template>
  <div
    ref="host"
    class="pointer-events-none absolute inset-0 overflow-hidden"
    :style="{ backgroundColor: theme.backgroundColor }"
  >
    <iframe
      v-if="url && width > 0 && height > 0 && !staticMode && !paused"
      :key="url"
      :src="url"
      title="网页背景"
      class="size-full border-0"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
    />
    <div class="absolute inset-0 bg-linear-to-b from-black/15 to-black/35" />
  </div>
</template>
