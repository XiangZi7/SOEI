<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import type { VisualizerBackgroundProps } from '../definition'
import { resolveBackgroundTuning } from '../tuning'
import { colorWithAlpha } from '../../../theme/colorMath'
import { useCoverDrift } from '../../../visual/useCoverDrift'
import {
  resolveMonetBackgroundDataUrl,
  getMonetBackgroundCacheKey,
  checkCanvasFilterSupport,
} from './monetBackgroundPipeline'
const props = defineProps<VisualizerBackgroundProps>()
const tuning = computed(() =>
  resolveBackgroundTuning('monet', props.tunings?.monet)
)
const pipeline = shallowRef<string | null>(null)
const drift = useTemplateRef<HTMLElement>('drift')
const key = computed(() =>
  getMonetBackgroundCacheKey({
    coverUrl: props.coverUrl,
    theme: props.theme,
    tuning: tuning.value,
  })
)
watch(
  key,
  (_key, _previous, onCleanup) => {
    let cancelled = false
    pipeline.value = null
    const timer = setTimeout(() => {
      void resolveMonetBackgroundDataUrl({
        coverUrl: props.coverUrl,
        theme: props.theme,
        tuning: tuning.value,
      }).then(url => {
        if (!cancelled) pipeline.value = url
      })
    }, 180)
    onCleanup(() => {
      cancelled = true
      clearTimeout(timer)
    })
  },
  { immediate: true }
)
useCoverDrift(drift, () => ({
  strength: tuning.value.backgroundDriftEnabled
    ? tuning.value.backgroundDriftStrength
    : 0,
  reducedMotion: Boolean(props.staticMode),
  paused: props.paused,
}))
const image = computed(() => pipeline.value ?? props.coverUrl)
const fallback = computed(
  () =>
    'linear-gradient(135deg,' +
    colorWithAlpha(props.theme.accentColor, 0.22) +
    ',' +
    props.theme.backgroundColor +
    ' 50%,' +
    colorWithAlpha(props.theme.primaryColor, 0.18) +
    ')'
)
const readability = computed(
  () =>
    'linear-gradient(90deg,' +
    colorWithAlpha(props.theme.backgroundColor, 0.18) +
    ' 0%,' +
    colorWithAlpha(props.theme.backgroundColor, 0.32) +
    ' 34%,' +
    colorWithAlpha(props.theme.backgroundColor, 0.82) +
    ' 100%)'
)
</script>
<template>
  <div
    class="monet-background"
    :style="{ background: fallback }"
  >
    <div
      ref="drift"
      class="absolute inset-0"
      :class="{ 'half-pane': tuning.backgroundLayout === 'half-pane-gradient' }"
    >
      <Transition name="monet-image">
        <img
          v-if="image"
          :key="image"
          :src="image"
          alt=""
          class="monet-image"
          :style="{
            objectPosition: 50 + tuning.backgroundHalfPaneOffsetX + '% center',
            filter:
              !pipeline || !checkCanvasFilterSupport()
                ? 'blur(' + tuning.backgroundBlurPx + 'px)'
                : undefined,
          }"
        />
      </Transition>
    </div>
    <div
      class="absolute inset-0"
      :style="{ background: readability }"
    />
  </div>
</template>
<style scoped>
.monet-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.monet-image {
  position: absolute;
  inset: -4%;
  width: 108%;
  height: 108%;
  max-width: none;
  object-fit: cover;
}
.half-pane {
  right: 24%;
  mask-image: linear-gradient(90deg, #000 0%, #000e 48%, transparent 100%);
}
.monet-image-enter-active,
.monet-image-leave-active {
  transition: opacity 800ms ease-in-out;
}
.monet-image-enter-from,
.monet-image-leave-to {
  opacity: 0;
}
</style>
