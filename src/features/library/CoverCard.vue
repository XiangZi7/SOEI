<script setup lang="ts">
import Artwork from '../../components/ui/Artwork.vue'
import { AppIcon, UiIconButton } from '../../components/ui'
import type { Track } from '../../types/music'
defineProps<{
  track: Track
  featured?: boolean
  showTitle?: boolean
  playing?: boolean
}>()
defineEmits<{
  select: [track: Track]
  favorite: [track: Track]
  preview: [track: Track | null]
}>()
</script>

<template>
  <article
    class="cover-cell group relative isolate aspect-square min-w-0 focus-within:z-30 hover:z-30"
    :class="{ featured, 'show-title': showTitle, playing }"
    @mouseenter="$emit('preview', track)"
    @mouseleave="$emit('preview', null)"
  >
    <div
      class="cover-card relative h-full border border-line shadow-panel transition-[transform,border-color,box-shadow] duration-(--motion-hover) group-focus-within:scale-[1.04] group-focus-within:border-accent/70 group-hover:scale-[1.04] group-hover:border-accent/70"
    >
      <button
        class="cover-hit relative block size-full cursor-pointer overflow-hidden text-left"
        :aria-label="
          (track.demo ? '预览' : '播放') +
          ' ' +
          track.title +
          ' · ' +
          track.artist
        "
        @click="$emit('select', track)"
        @focus="$emit('preview', track)"
        @blur="$emit('preview', null)"
      >
        <Artwork
          :artwork="track.artwork"
          :src="track.coverRef"
          :title="track.title + ' 封面'"
        />
        <span
          class="absolute inset-0 bg-(image:--gradient-cover) transition-opacity duration-(--motion-hover) group-focus-within:opacity-100 group-hover:opacity-100"
          :class="featured || showTitle ? 'opacity-100' : 'opacity-0'"
        />
        <span
          class="cover-details absolute right-10 bottom-4 left-4 transition-[opacity,transform] duration-(--motion-hover) group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
          :class="
            featured || showTitle
              ? 'translate-y-0 opacity-100'
              : 'translate-y-1 opacity-0'
          "
          ><span
            class="cover-title block font-display text-xl leading-tight wrap-anywhere"
            >{{ track.title }}</span
          ><span
            class="mt-1.5 block font-display text-caption tracking-widest text-muted"
            >{{ track.artist }}</span
          ></span
        >
        <span
          class="absolute right-3.5 bottom-4.5 transition-opacity duration-(--motion-hover) group-focus-within:opacity-100 group-hover:opacity-100"
          :class="featured ? 'opacity-100' : 'opacity-0'"
          ><AppIcon
            :name="track.demo ? 'arrow-up-right' : 'play'"
            :size="18"
        /></span>
        <span
          v-if="playing"
          class="absolute top-3 left-3 flex h-3 items-end gap-0.5"
          ><i class="playing-bar" /><i
            class="playing-bar [animation-delay:-.3s]"
          /><i class="playing-bar [animation-delay:-.6s]" /><span
            class="sr-only"
            >正在播放</span
          ></span
        >
      </button>
      <UiIconButton
        icon="heart"
        :icon-size="15"
        :label="(track.favorite ? '取消收藏' : '收藏') + ' ' + track.title"
        :active="track.favorite"
        class="absolute top-1.5 right-1.5 size-8 bg-glass transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        :class="track.favorite ? 'text-favorite opacity-100' : 'opacity-0'"
        @click="$emit('favorite', track)"
      />
      <span
        v-if="featured && track.demo"
        class="absolute -bottom-7 left-5.5 font-display text-[7px] tracking-[.3em] text-muted max-[850px]:hidden"
        >VISUAL PREVIEW</span
      >
    </div>
  </article>
</template>
<style scoped>
.featured {
  grid-column: 3;
  grid-row: 2 / 4;
  aspect-ratio: auto;
}
.featured .cover-card {
  width: 155%;
  height: 93%;
  margin-left: -27.5%;
  margin-top: -13%;
}
.featured .cover-details {
  bottom: 24px;
  left: 22px;
}
.featured .cover-title {
  font-size: clamp(27px, 2.8vw, 38px);
  font-style: italic;
}
.playing-bar {
  width: 2px;
  height: 10px;
  background: var(--color-accent);
  animation: equalizer 0.9s ease-in-out infinite alternate;
}
@keyframes equalizer {
  to {
    height: 3px;
  }
}
@media (max-width: 1100px) {
  .featured .cover-card {
    width: 125%;
    margin-left: -12.5%;
    margin-top: 0;
    height: 90%;
  }
}
@media (max-width: 850px) {
  .featured {
    grid-column: auto;
    grid-row: auto;
    aspect-ratio: 1;
  }
  .featured .cover-card {
    width: 100%;
    height: 100%;
    margin: 0;
  }
  .featured .cover-title {
    font-size: 23px;
  }
}
</style>
