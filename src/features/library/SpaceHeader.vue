<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { AppIcon, UiButton } from '../../components/ui'
import type { LibraryTab } from '../../types/music'
import { call, desktop } from '../../bridge/native'

const store = useMusicStore()
const { tab, recentOnly, favoritesOnly } = storeToRefs(store)
defineEmits<{ search: []; settings: []; import: [] }>()
const navigation: {
  id: LibraryTab | 'recent' | 'favorites'
  title: string
  label: string
}[] = [
  { id: 'all', title: 'All', label: '所有歌曲' },
  { id: 'recent', title: 'Recently Played', label: '最近播放' },
  { id: 'favorites', title: 'Favorites', label: '收藏' },
  { id: 'albums', title: 'Albums', label: '专辑' },
  { id: 'artists', title: 'Artists', label: '歌手' },
  { id: 'playlists', title: 'Playlists', label: '播放列表' },
]
function active(id: (typeof navigation)[number]['id']) {
  if (id === 'recent') return recentOnly.value
  if (id === 'favorites') return favoritesOnly.value
  return tab.value === id && !recentOnly.value && !favoritesOnly.value
}
function navigate(id: (typeof navigation)[number]['id']) {
  store.recentOnly = id === 'recent'
  store.favoritesOnly = id === 'favorites'
  store.tab = id === 'recent' || id === 'favorites' ? 'all' : id
}
function drag(event: MouseEvent) {
  if (desktop && event.button === 0)
    void call('window_action', { action: 'drag' }).catch(store.report)
}
function maximize() {
  if (desktop)
    void call('window_action', { action: 'maximize' }).catch(store.report)
}
</script>

<template>
  <header
    class="space-header flex items-center gap-8"
    @mousedown.self="drag"
    @dblclick.self="maximize"
  >
    <button
      class="music-wordmark shrink-0 text-left"
      aria-label="回到音乐空间"
      @click="navigate('all')"
    >
      <span
        class="block font-display text-[clamp(38px,4vw,54px)] leading-none font-light tracking-[-.035em]"
        >MUSIC</span
      >
      <span
        class="mt-2.5 block font-display text-[8px] leading-[1.5] tracking-[.12em] text-muted"
        >A THOUSAND WORLDS<br />IN A SINGLE SONG.</span
      >
    </button>
    <nav
      class="music-navigation flex flex-1 items-center gap-[clamp(16px,2vw,30px)]"
      aria-label="音乐库分类"
      @mousedown.self="drag"
      @dblclick.self="maximize"
    >
      <button
        v-for="item in navigation"
        :key="item.id"
        class="nav-link relative min-h-8 font-display text-[14px] whitespace-nowrap transition-colors hover:text-ink"
        :class="active(item.id) ? 'is-active text-ink' : 'text-muted'"
        :aria-label="item.label"
        :aria-current="active(item.id) ? 'page' : undefined"
        @click="navigate(item.id)"
      >
        {{ item.title }}
      </button>
    </nav>
    <div class="header-actions flex items-center gap-4">
      <UiButton
        variant="text"
        class="gap-1.5 px-0 font-display text-[13px]"
        aria-label="搜索音乐"
        @click="$emit('search')"
        ><AppIcon
          name="search"
          :size="13"
        /><span>Search</span></UiButton
      >
      <span
        class="h-3 w-px bg-line"
        aria-hidden="true"
      />
      <UiButton
        variant="text"
        class="gap-1.5 px-0 font-display text-[13px]"
        aria-label="设置"
        @click="$emit('settings')"
        ><AppIcon
          name="settings-2"
          :size="13"
        /><span>Settings</span></UiButton
      >
      <UiButton
        variant="text"
        class="px-0"
        aria-label="导入音乐"
        title="导入音乐"
        @click="$emit('import')"
        ><AppIcon
          name="plus"
          :size="14"
      /></UiButton>
    </div>
    <slot name="window" />
  </header>
</template>

<style scoped>
.space-header {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: var(--z-controls);
  min-height: 112px;
  padding: 12px max(5vw, calc((100vw - 1280px) / 2 + 28px));
  gap: clamp(14px, 2vw, 28px);
  background: linear-gradient(180deg, #080d0dec, #080d0ce0 80%, #080d0cba);
  backdrop-filter: blur(18px);
}
.nav-link,
.header-actions :deep(button) {
  min-height: var(--spacing-header-control);
}
.music-wordmark {
  color: #dfded6;
}
.nav-link::after {
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 16px;
  height: 1px;
  content: '';
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--motion-hover);
}
.nav-link.is-active::after {
  transform: scaleX(1);
}
@media (max-width: 1000px) {
  .space-header {
    flex-wrap: wrap;
    gap: 12px 24px;
  }
  .music-navigation {
    order: 3;
    flex-basis: 100%;
    padding-top: 0;
    justify-content: space-between;
  }
  .header-actions {
    margin-left: auto;
  }
}
@media (max-width: 600px) {
  .space-header {
    padding: 12px 30px;
  }
  .music-navigation {
    gap: 18px;
    overflow-x: auto;
    justify-content: flex-start;
    padding-bottom: 5px;
  }
  .nav-link {
    font-size: 13px;
  }
  .header-actions {
    gap: 10px;
  }
  .header-actions span:not([aria-hidden]) {
    display: none;
  }
}
</style>
