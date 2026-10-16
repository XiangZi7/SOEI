<script setup lang="ts">
import { computed } from 'vue'
import type { VisualizerBackgroundProps } from '../definition'
import { resolveBackgroundTuning } from '../tuning'
import FluidBackground from './FluidBackground.vue'
import GeometricBackground from './GeometricBackground.vue'
const props = defineProps<VisualizerBackgroundProps>()
const tuning = computed(() =>
  resolveBackgroundTuning('common', props.tunings?.common)
)
</script>
<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden"
    :style="{ backgroundColor: theme.backgroundColor }"
  >
    <FluidBackground
      v-if="tuning.useCoverColorBg"
      :cover-url="coverUrl"
      :theme="theme"
    />
    <div
      class="absolute inset-0 transition-opacity duration-1000"
      :style="{
        backgroundColor: theme.backgroundColor,
        opacity: tuning.useCoverColorBg ? tuning.opacity : 1,
      }"
    />
    <GeometricBackground
      v-if="!staticMode"
      v-bind="props"
      :hide-shapes="tuning.disableGeometricBackground"
      :disable-vignette="tuning.disableVignette"
    />
  </div>
</template>
