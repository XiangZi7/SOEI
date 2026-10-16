<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { pushMonetPortraitLayer, settleMonetPortraitLayers, type MonetPortraitLayer } from './monetPortraitCrossfade'
const props = defineProps<{ src?: string | null; reducedMotion?: boolean }>()
const layers = shallowRef<MonetPortraitLayer[]>([])
let key = 0
watch(() => props.src, (src, _old, onCleanup) => {
  if (!src) return
  let cancelled = false
  onCleanup(() => { cancelled = true })
  const image = new Image(); image.decoding = 'async'
  const commit = () => { if (!cancelled) layers.value = pushMonetPortraitLayer(layers.value, src, String(++key)) }
  image.src = src
  if (image.decode) void image.decode().then(commit, () => {})
  else image.onload = commit
}, { immediate: true })
function settle(key: string) { layers.value = settleMonetPortraitLayers(layers.value, key) }
</script>
<template>
  <TransitionGroup name="portrait" tag="div" class="relative size-full" :class="{ 'opacity-0': !src }" :css="!reducedMotion" @after-enter="element => settle(element.getAttribute('data-key') ?? '')">
    <img v-for="layer in layers" :key="layer.key" :data-key="layer.key" :src="layer.src" alt="专辑封面" class="absolute inset-0 size-full object-cover" draggable="false" />
  </TransitionGroup>
</template>
<style scoped>
.portrait-enter-active { transition: opacity 900ms ease-in-out; }
.portrait-enter-from { opacity: 0; }
</style>
