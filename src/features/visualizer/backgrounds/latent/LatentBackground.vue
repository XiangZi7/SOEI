<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import {
  defaultObjectSizing,
  ShaderFitOptions,
  getShaderColorFromString,
  meshGradientFragmentShader,
  ditheringFragmentShader,
  DitheringShapes,
  DitheringTypes,
} from '@paper-design/shaders'
import type { VisualizerBackgroundProps } from '../definition'
import { resolveBackgroundTuning } from '../tuning'
import { usePaperShader } from '../usePaperShader'
import { useVisualizerFrame } from '../../useVisualizerFrame'
import { extractCoverColors } from '../../../theme/coverPalette'
import {
  resolveLatentShaderColors,
  resolveLatentBroadbandEnergy,
  resolveLatentOnsetPulse,
  resolveLatentAudioSpeedTarget,
} from './latentFrame'
import { paperSizing } from '../paperSizing'
const props = defineProps<VisualizerBackgroundProps>()
const tuning = computed(() =>
  resolveBackgroundTuning('latent', props.tunings?.latent)
)
const colors = shallowRef<string[]>([])
watch(
  () => props.coverUrl,
  (url, _old, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    colors.value = []
    if (url)
      void extractCoverColors({ coverRef: url }, 6).then(value => {
        if (!cancelled) colors.value = value
      })
  },
  { immediate: true }
)
const palette = computed(() =>
  resolveLatentShaderColors(colors.value, props.theme, tuning.value.colorSource)
)
const meshHost = useTemplateRef<HTMLElement>('meshLayer')
const ditherHost = useTemplateRef<HTMLElement>('ditherLayer')
const mesh = usePaperShader(meshHost, () => ({
  fragment: meshGradientFragmentShader,
  uniforms: {
    ...paperSizing(defaultObjectSizing, ShaderFitOptions.cover),
    u_colors: palette.value.mesh.map(color => getShaderColorFromString(color)),
    u_colorsCount: palette.value.mesh.length,
    u_distortion: tuning.value.meshDistortion,
    u_swirl: tuning.value.meshSwirl,
    u_grainMixer: 0,
    u_grainOverlay: 0.01,
  },
}))
const dither = usePaperShader(ditherHost, () => ({
  fragment: ditheringFragmentShader,
  uniforms: {
    ...paperSizing(defaultObjectSizing, ShaderFitOptions.cover),
    u_colorBack: getShaderColorFromString(palette.value.ditheringBack),
    u_colorFront: getShaderColorFromString(palette.value.ditheringFront),
    u_shape: DitheringShapes.warp,
    u_type: DitheringTypes['4x4'],
    u_pxSize: tuning.value.ditheringSize,
  },
}))
let meshTime = 0,
  ditherTime = 0,
  previous: number | null = null
let energy = 0,
  onset = 0,
  speed = 0
function paint() {
  const now = performance.now()
  const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.1)
  previous = now
  if (props.paused || props.staticMode) return
  const bands = props.audioBands
  const current = resolveLatentBroadbandEnergy(
    bands.bass.get(),
    bands.lowMid.get(),
    bands.mid.get(),
    bands.vocal.get(),
    bands.treble.get()
  )
  onset = tuning.value.enhancedBeatResponse
    ? resolveLatentOnsetPulse(current, energy, onset)
    : 0
  energy = current
  const target = resolveLatentAudioSpeedTarget(
    energy,
    onset,
    tuning.value.enhancedBeatResponse
  )
  speed += (target - speed) * (1 - Math.exp(-dt * (target > speed ? 33 : 9)))
  const bass = Math.min(1, Math.max(0, bands.bass.get()))
  const mid = Math.min(1, Math.max(bands.mid.get(), bands.vocal.get()))
  const power = Math.min(1, Math.max(0, props.audioPower.get()))
  meshTime +=
    dt *
    1000 *
    (tuning.value.meshSpeed +
      (tuning.value.meshAudioSpeed - tuning.value.meshSpeed) * speed)
  ditherTime +=
    dt *
    1000 *
    (tuning.value.ditheringSpeed +
      (tuning.value.ditheringAudioSpeed - tuning.value.ditheringSpeed) * speed)
  mesh.frame(meshTime, {
    u_distortion: tuning.value.meshDistortion + power * 0.62,
    u_swirl: tuning.value.meshSwirl + mid * 0.38,
  })
  dither.frame(ditherTime, {
    u_pxSize: Math.max(0.5, tuning.value.ditheringSize * (1 - bass * 0.34)),
  })
  if (meshHost.value) {
    meshHost.value.style.filter =
      'saturate(' +
      (1.04 + mid * 0.34) +
      ') brightness(' +
      (0.94 + power * 0.16) +
      ')'
    meshHost.value.style.transform = 'scale(' + (1.025 + power * 0.018) + ')'
  }
  if (ditherHost.value) {
    ditherHost.value.style.opacity =
      tuning.value.displayMode !== 'dithering'
        ? String(Math.min(1, tuning.value.ditheringOpacity + bass * 0.25))
        : '1'
    ditherHost.value.style.transform = 'scale(' + (1.015 + bass * 0.025) + ')'
  }
}
watch([() => props.paused, () => props.staticMode], () => {
  previous = null
})
useVisualizerFrame({
  source: () => props.audioPower,
  running: () => !props.paused && !props.staticMode,
  frameRate: () => props.frameRate ?? 30,
  paint,
})
</script>
<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden"
    :style="{ backgroundColor: theme.backgroundColor }"
  >
    <div
      v-if="tuning.displayMode !== 'dithering'"
      ref="meshLayer"
      class="absolute inset-0 scale-103"
    />
    <div
      v-if="tuning.displayMode !== 'mesh'"
      ref="ditherLayer"
      class="absolute inset-0 scale-102"
      :style="{
        mixBlendMode: tuning.displayMode === 'both' ? 'soft-light' : 'normal',
        opacity: tuning.displayMode === 'both' ? tuning.ditheringOpacity : 1,
      }"
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
