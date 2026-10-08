<script setup lang="ts">
import Artwork from '../../components/ui/Artwork.vue'
import type { Track } from '../../types/music'

defineProps<{ name: string; tracks: Track[] }>()
defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    class="collection-card group block w-full max-w-55 min-w-0 overflow-hidden rounded-input border border-transparent text-left transition-colors hover:border-line hover:bg-hover focus-visible:border-accent"
    :aria-label="`${name} · ${tracks.length} 首音乐`"
    @click="$emit('select')"
  >
    <span class="block aspect-square w-full overflow-hidden border border-line">
      <Artwork
        :artwork="tracks[0]?.artwork"
        :src="tracks[0]?.coverRef"
        :title="name"
        class="transition-transform duration-(--motion-hover) group-hover:scale-[1.04]"
      />
    </span>
    <span class="block px-3 pt-4 pb-3">
      <span
        class="line-clamp-2 min-h-14 font-display text-xl leading-7 wrap-anywhere"
        :title="name"
        >{{ name }}</span
      >
      <span class="mt-2 block text-caption leading-5 text-muted">
        {{ tracks.length }} 首音乐
      </span>
    </span>
  </button>
</template>
