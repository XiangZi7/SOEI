<script setup lang="ts">
import Artwork from '../../components/ui/Artwork.vue'
import { AppIcon, UiIconButton } from '../../components/ui'
import type { Track } from '../../types/music'
withDefaults(
  defineProps<{
    track: Track
    featured?: boolean
    showTitle?: boolean
    playing?: boolean
    // 入场 stagger 的序号，由画廊按网格顺序给出。
    index?: number
  }>(),
  { index: 0 }
)
defineEmits<{
  select: [track: Track]
  favorite: [track: Track]
  preview: [track: Track | null]
}>()
</script>

<template>
  <article
    class="cover-cell group relative isolate min-w-0"
    :class="{ featured, 'show-title': showTitle, playing }"
    :style="{ '--cell-index': index }"
    @mouseenter="$emit('preview', track)"
    @mouseleave="$emit('preview', null)"
  >
    <div
      class="cover-card relative h-full rounded-[3px] border border-line transition-[border-color,box-shadow,transform] duration-(--motion-hover)"
    >
      <button
        class="cover-hit relative block size-full cursor-pointer overflow-hidden rounded-[2px] text-left"
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
        <span class="cover-shade absolute inset-0" />
        <span
          class="cover-play absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-ink/60 bg-black/25 text-ink"
          ><AppIcon
            :name="playing ? 'pause' : 'play'"
            :size="15"
        /></span>
        <span
          class="cover-details absolute right-0 bottom-0 left-0 px-3 py-2.5"
        >
          <span class="block truncate font-display text-[18px] leading-tight">{{
            track.title
          }}</span>
          <span
            class="mt-1 flex items-center gap-1.5 font-display text-[10px] tracking-[.1em] text-ink/75"
            ><AppIcon
              name="music-2"
              :size="10"
            />{{ track.artist }}</span
          >
        </span>
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
        :icon-size="13"
        :label="(track.favorite ? '取消收藏' : '收藏') + ' ' + track.title"
        :active="track.favorite"
        class="favorite-button absolute top-1 right-1 size-8 bg-black/30"
        :class="
          track.favorite
            ? 'text-favorite opacity-100'
            : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
        "
        @click="$emit('favorite', track)"
      />
    </div>
  </article>
</template>

<style scoped>
.cover-cell {
  aspect-ratio: 0.95;
  /* 入场 stagger。延迟按序号递增但封顶 360ms，
     否则上千首的音乐库会出现十几秒才走完的波浪。 */
  animation: cover-rise 420ms var(--ease-scene) backwards;
  animation-delay: min(calc(var(--cell-index, 0) * 22ms), 360ms);
}
@keyframes cover-rise {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
}
.cover-card {
  background: #070b0c;
}
.cover-hit :deep(svg),
.cover-hit :deep(img) {
  opacity: 0.86;
  filter: saturate(0.7);
  transition:
    opacity var(--motion-hover),
    filter var(--motion-hover),
    transform var(--motion-scene) var(--ease-scene);
}
.cover-shade {
  background: linear-gradient(180deg, transparent 50%, #02060645);
}
.cover-details {
  background: linear-gradient(180deg, #060a0be8, #060a0b);
  opacity: 0;
  transition: opacity var(--motion-hover);
}
.cover-play {
  opacity: 0;
  transition: opacity var(--motion-hover);
}
.featured {
  z-index: 2;
}
.featured .cover-card {
  border-color: #e6e5de;
  box-shadow:
    0 0 0 1px #e6e5de50,
    0 8px 25px #0008;
}
.featured .cover-hit {
  overflow: visible;
}
.featured .cover-details {
  bottom: -40px;
  min-height: 40px;
  padding: 6px 10px;
  border: 1px solid #e6e5de;
  border-top: 0;
  border-radius: 0 0 3px 3px;
}
.featured .cover-details > span:first-child {
  font-size: 15px;
}
.featured .cover-details > span:last-child {
  margin-top: 2px;
  font-size: 9px;
}
.featured .cover-play {
  top: 70%;
}
.featured .cover-card,
.cover-cell:hover .cover-card,
.cover-cell:focus-within .cover-card {
  border-color: #deded4bf;
}
.featured .cover-play,
.featured .cover-details,
.show-title .cover-details,
.cover-cell:hover .cover-play,
.cover-cell:hover .cover-details,
.cover-cell:focus-within .cover-play,
.cover-cell:focus-within .cover-details {
  opacity: 1;
}
.featured .cover-hit :deep(svg),
.cover-cell:hover .cover-hit :deep(svg),
.cover-cell:hover .cover-hit :deep(img) {
  opacity: 1;
  filter: saturate(0.85);
}
/* 悬停景深：卡片微抬 + 封面缓慢推近，描边与投影跟随封面取色。 */
.cover-cell:hover .cover-card,
.cover-cell:focus-within .cover-card {
  transform: translateY(-3px);
  border-color: color-mix(
    in srgb,
    var(--theme-accent, var(--color-accent)) 55%,
    transparent
  );
  box-shadow:
    0 0 0 1px var(--theme-glow-soft, transparent),
    0 14px 34px #00000059;
}
/* featured 卡片的 .cover-hit 是 overflow: visible（为了让信息条挂在下方），
   推近封面会溢出，所以只在普通卡片上做。 */
.cover-cell:not(.featured):hover .cover-hit :deep(svg),
.cover-cell:not(.featured):hover .cover-hit :deep(img) {
  transform: scale(1.05);
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
@media (max-width: 600px) {
  .featured .cover-details {
    bottom: 0;
    border: 0;
    background: linear-gradient(transparent, #020606f2);
    padding: 10px;
  }
  .featured .cover-play {
    top: 45%;
  }
}
</style>
