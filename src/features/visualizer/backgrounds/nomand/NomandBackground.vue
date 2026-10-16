<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { VisualizerBackgroundProps } from '../definition'
import { resolveBackgroundTuning } from '../tuning'
import { usePaperShader } from '../usePaperShader'
import { nomandShader } from './nomandShader'
const props = defineProps<VisualizerBackgroundProps>()
const tuning = computed(() =>
  resolveBackgroundTuning('nomand', props.tunings?.nomand)
)
const host = useTemplateRef<HTMLElement>('host')
usePaperShader(
  host,
  () => ({
    ...nomandShader(tuning.value, props.theme, props.isDaylight),
    imageUrl: props.coverUrl,
  }),
  1920 * 1080
)
</script>
<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden"
    :style="{ backgroundColor: theme.backgroundColor }"
  >
    <div
      v-if="coverUrl"
      ref="host"
      class="absolute inset-0"
    />
    <div
      v-if="tuning.overlayEnabled"
      class="absolute inset-0"
      :style="{
        backgroundColor: theme.backgroundColor,
        opacity: tuning.overlayOpacity,
      }"
    />
  </div>
</template>
