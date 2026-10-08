<script setup lang="ts">
import { useMusicStore } from '../../stores/music'
import { storeToRefs } from 'pinia'
import { AppIcon, UiButton } from '../../components/ui'
import type { LibraryTab } from '../../types/music'
const store = useMusicStore()
const { tab } = storeToRefs(store)
defineEmits<{ search: []; settings: []; import: [] }>()
const navigation: { id: LibraryTab; title: string; label: string }[] = [
  { id: 'all', title: 'ALL', label: '所有歌曲' },
  { id: 'albums', title: 'ALBUMS', label: '专辑' },
  { id: 'artists', title: 'ARTISTS', label: '歌手' },
  { id: 'playlists', title: 'PLAYLISTS', label: '播放列表' },
]
</script>

<template>
  <header
    class="grid h-26 grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 max-sm:h-auto max-sm:grid-cols-[1fr_auto] max-sm:pt-5 lg:px-[3.5vw]"
  >
    <UiButton
      variant="text"
      class="gap-4 justify-self-start p-0 text-left text-ink"
      aria-label="回到音乐空间"
      @click="tab = 'all'"
    >
      <svg
        class="size-6 opacity-75 max-lg:hidden"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M18 2v12M18 22v12M2 18h12M22 18h12M7 7l8 8m6 6 8 8M7 29l8-8m6-6 8-8"
          stroke="currentColor"
          stroke-width=".9"
        />
        <circle
          cx="18"
          cy="18"
          r="3"
          stroke="currentColor"
          stroke-width=".7"
        />
      </svg>
      <span
        ><span
          class="block font-display text-[15px] tracking-[.28em] whitespace-nowrap max-lg:text-label max-lg:tracking-[.18em]"
          >MUSIC SPACE</span
        ><span
          class="mt-2 block font-display text-[7px] tracking-[.32em] text-muted max-lg:hidden"
          >A HIGHER WAY TO FEEL MUSIC</span
        ></span
      >
    </UiButton>
    <nav
      class="flex h-full items-stretch gap-6 max-sm:col-span-2 max-sm:row-start-2 max-sm:h-15 max-sm:justify-between lg:gap-[3.7vw]"
      aria-label="音乐库分类"
    >
      <button
        v-for="item in navigation"
        :key="item.id"
        class="relative cursor-pointer font-display text-[11px] tracking-[.17em] transition-colors duration-(--motion-hover) after:absolute after:right-0 after:bottom-7 after:left-0 after:h-px after:bg-ink after:transition-transform after:duration-(--motion-hover) max-sm:after:bottom-2.5"
        :class="
          tab === item.id
            ? 'text-ink after:scale-x-100'
            : 'text-muted after:scale-x-0 hover:text-ink'
        "
        :aria-label="item.label"
        :aria-current="tab === item.id ? 'page' : undefined"
        @click="tab = item.id"
      >
        {{ item.title }}
      </button>
    </nav>
    <div
      class="flex items-center justify-end gap-4 max-sm:col-start-2 max-sm:row-start-1"
    >
      <UiButton
        variant="text"
        class="gap-2.5 px-0 font-display tracking-wider"
        aria-label="搜索音乐"
        @click="$emit('search')"
        ><AppIcon
          name="search"
          :size="17"
        /><span class="max-lg:hidden">Search</span></UiButton
      >
      <span class="h-4 w-px bg-line" />
      <UiButton
        variant="text"
        class="gap-2.5 px-0 font-display tracking-wider"
        aria-label="设置"
        @click="$emit('settings')"
        ><AppIcon
          name="settings-2"
          :size="17"
        /><span class="max-lg:hidden">Settings</span></UiButton
      >
    </div>
  </header>
</template>
