<script setup lang="ts">
import { useTemplateRef } from 'vue'
import type { ArtworkCrop, Preferences, SceneLayout } from '../../types/music'
import Artwork from '../../components/ui/Artwork.vue'
import { assetUrl } from '../../bridge/native'
import { useStageRenderer } from './useStageRenderer'

const props = defineProps<{
  artwork?: ArtworkCrop
  cover?: string | null
  background: string
  video: boolean
  color: string
  layout: SceneLayout
  animated: boolean
  reducedMotion: boolean
  quality: Preferences['quality']
  energy: number
}>()
defineEmits<{ backgroundFailed: [] }>()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
useStageRenderer(canvas, () => props)
</script>

<template>
  <div class="stage-backdrop" :class="{ 'still-stage': !animated || reducedMotion || quality === 'power' }" aria-hidden="true">
    <div class="stage-atmosphere" />
    <Transition name="fade">
      <div :key="background || cover || artwork?.source || 'empty'" class="stage-artwork" :class="{ 'custom-background': background }">
        <video v-if="video" class="background-media" :src="assetUrl(background)" autoplay muted loop playsinline @error="$emit('backgroundFailed')" />
        <Artwork v-else-if="background" :src="background" title="场景背景" />
        <Artwork v-else :artwork="artwork" :src="cover" title="封面光场" />
      </div>
    </Transition>
    <canvas ref="canvas" class="stage-canvas" />
    <div class="stage-vignette" />
    <svg class="stage-geometry" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
      <circle class="orbit orbit-one" cx="1070" cy="310" r="238" />
      <circle class="orbit orbit-two" cx="1070" cy="310" r="286" stroke-dasharray="2 18" />
      <path class="stage-thread" d="M-80 690C280 820 320 40 830 160S1190 820 1520 620" />
      <path class="stage-star" d="m1098 178 14 32 35 5-27 23 5 35-27-18-30 18 6-34-27-24 35-5Z" />
      <path class="stage-star star-small" d="m290 630 7 17 19 3-15 12 3 19-14-10-16 10 3-18-14-13 19-3Z" />
      <circle class="stage-dot" cx="393" cy="190" r="3" />
      <circle class="stage-dot" cx="1150" cy="628" r="2" />
    </svg>
  </div>
</template>

<style scoped>
.stage-backdrop, .stage-atmosphere, .stage-artwork, .stage-canvas, .stage-vignette, .stage-geometry { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.stage-backdrop { overflow: hidden; background: #080d18; }
.stage-atmosphere { background: radial-gradient(ellipse at 65% 42%, color-mix(in srgb, var(--stage-color) 17%, transparent), transparent 65%), linear-gradient(125deg, #080c14, #101a30 55%, #080d18); }
.stage-artwork { opacity: .13; filter: blur(65px) saturate(.8); transform: scale(1.2); }
.stage-artwork.custom-background { opacity: .34; filter: none; transform: none; }
.background-media { width: 100%; height: 100%; object-fit: cover; }
.stage-vignette { background: radial-gradient(ellipse at 50% 45%, transparent 15%, #04081188 100%), linear-gradient(0deg, #050913a6, transparent 30%); }
.stage-geometry { opacity: .55; }
.orbit { stroke: var(--stage-color); stroke-width: .65; opacity: .19; transform-origin: 1070px 310px; }
.orbit-two { opacity: .3; animation: orbit-drift 100s linear infinite; }
.stage-thread { stroke: var(--stage-color); stroke-width: .65; opacity: .2; }
.stage-star { stroke: var(--color-stage-gold); stroke-width: 1; opacity: .25; transform-origin: 1100px 220px; animation: constellation-drift 18s ease-in-out infinite alternate; }
.star-small { opacity: .16; transform-origin: 290px 650px; animation-delay: -8s; }
.stage-dot { fill: var(--color-stage-gold); opacity: .5; }
.still-stage .stage-geometry * { animation-play-state: paused; }
@keyframes orbit-drift { to { transform: rotate(360deg); } }
@keyframes constellation-drift { to { transform: translate(7px, -14px) rotate(12deg); } }
</style>
