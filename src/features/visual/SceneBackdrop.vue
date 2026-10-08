<script setup lang="ts">
import { useTemplateRef } from 'vue'
import type { ArtworkCrop, Preferences, SceneLayout } from '../../types/music'
import Artwork from '../../components/ui/Artwork.vue'
import { assetUrl } from '../../bridge/native'
import { useStageRenderer } from './useStageRenderer'
import SceneIllustration from './SceneIllustration.vue'

const props = defineProps<{
  artwork?: ArtworkCrop
  cover?: string | null
  trackKey?: string
  background: string
  video: boolean
  color: string
  layout: SceneLayout
  variant: number
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
  <div
    class="pointer-events-none absolute inset-0 size-full overflow-hidden bg-stage"
    :class="{
      'still-stage': !animated || reducedMotion || quality === 'power',
    }"
    aria-hidden="true"
  >
    <div class="absolute inset-0 bg-(image:--gradient-stage)" />
    <Transition name="ambient-cover">
      <div
        :key="
          background ||
          trackKey ||
          cover ||
          (artwork ? `${artwork.source}-${artwork.x}-${artwork.y}` : 'empty')
        "
        class="absolute inset-0 size-full"
        :class="
          background
            ? 'opacity-35'
            : 'scale-120 opacity-13 blur-[65px] saturate-80'
        "
      >
        <video
          v-if="video"
          class="size-full object-cover"
          :src="assetUrl(background)"
          autoplay
          muted
          loop
          playsinline
          @error="$emit('backgroundFailed')"
        />
        <Artwork
          v-else-if="background"
          eager
          :src="background"
          title="场景背景"
        />
        <Artwork
          v-else
          eager
          :artwork="artwork"
          :src="cover"
          title="封面光场"
        />
      </div>
    </Transition>
    <canvas
      ref="canvas"
      class="absolute inset-0 size-full"
    />
    <div class="absolute inset-0 bg-(image:--gradient-stage-shade)" />
    <SceneIllustration
      :layout="layout"
      :variant="variant"
      :animated="animated && !reducedMotion && quality !== 'power'"
    />
  </div>
</template>
