<script setup lang="ts">
import type { ArtworkCrop } from '../../types/music'
import { assetUrl } from '../../bridge/native'
import AppIcon from './AppIcon.vue'
defineProps<{ artwork?: ArtworkCrop; src?: string | null; title?: string }>()
</script>
<template>
  <svg
    v-if="artwork"
    class="block size-full object-cover"
    :viewBox="`${artwork.x} ${artwork.y} ${artwork.width} ${artwork.height}`"
    preserveAspectRatio="xMidYMid slice"
    role="img"
    :aria-label="title ?? '封面'"
  >
    <image
      :href="artwork.source"
      :width="artwork.sourceWidth"
      :height="artwork.sourceHeight"
    />
  </svg>
  <img
    v-else-if="src"
    class="block size-full object-cover"
    :src="assetUrl(src)"
    :alt="title ?? '音乐封面'"
    loading="lazy"
  />
  <div
    v-else
    class="relative flex-center size-full overflow-hidden bg-(image:--gradient-artwork) text-muted"
    aria-hidden="true"
  >
    <span
      class="absolute aspect-square w-[64%] rounded-full border border-line shadow-panel"
    /><AppIcon
      name="music-2"
      :size="34"
    />
  </div>
</template>
