<script setup lang="ts">
import { computed } from 'vue'
import type { VisualizerSharedProps } from './definition'
import { visualizerEntry } from './registry'
import VisualizerShell from './VisualizerShell.vue'
import VisualizerBackgroundRenderer from './backgrounds/VisualizerBackgroundRenderer.vue'

// 统一 renderer：按 mode 从注册表取 entry，套上共享外壳再渲染该模式。
// 从 Folia VisualizerRenderer.tsx 移植。
const props = defineProps<{
  mode: string
  shared: VisualizerSharedProps
  canGoBack?: boolean
  backgroundMode?: string
  backgroundTunings?: Record<string, unknown>
}>()
const emit = defineEmits<{ back: [] }>()

const entry = computed(() => visualizerEntry(props.mode))
</script>

<template>
  <VisualizerShell
    v-if="entry"
    :theme="shared.theme"
    :visualizer-opacity="shared.visualizerOpacity"
    :can-go-back="canGoBack"
    @back="emit('back')"
  >
    <template #background>
      <slot
        v-if="entry.rendersBackground !== false"
        name="background"
      >
        <VisualizerBackgroundRenderer
          :mode="backgroundMode"
          :shared="{
            ...shared,
            tunings: backgroundTunings,
            staticMode: shared.backgroundStaticMode ?? shared.staticMode,
          }"
        />
      </slot>
    </template>
    <!-- entry.component 是异步组件；Suspense 边界由此处提供。 -->
    <Suspense>
      <component
        :is="entry.component"
        v-bind="shared"
      />
      <template #fallback>
        <slot name="loading" />
      </template>
    </Suspense>
  </VisualizerShell>
</template>
