<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { AppIcon, UiDialog, UiIconButton, UiInput } from '../../components/ui'
import Artwork from '../../components/ui/Artwork.vue'
import type { Track } from '../../types/music'

const emit = defineEmits<{ close: []; select: [track: Track] }>()
const store = useMusicStore()
const { tracks, snapshot } = storeToRefs(store)
const state = reactive({ query: '' })
const input = useTemplateRef<InstanceType<typeof UiInput>>('searchInput')
const results = computed(() => {
  const query = state.query.trim().toLocaleLowerCase()
  return query
    ? tracks.value.filter(track =>
        `${track.title} ${track.artist} ${track.album}`
          .toLocaleLowerCase()
          .includes(query)
      )
    : []
})
onMounted(async () => {
  await nextTick()
  input.value?.focus()
})
function select(track: Track) {
  emit('close')
  emit('select', track)
}
</script>

<template>
  <UiDialog
    title="搜索音乐"
    class="w-[min(640px,calc(100vw-2rem))]"
    @close="emit('close')"
  >
    <header
      class="flex min-h-22 items-center gap-3 border-b border-line px-6 py-5 max-sm:px-4"
    >
      <AppIcon
        name="search"
        :size="20"
        class="shrink-0 text-muted"
      />
      <UiInput
        ref="searchInput"
        v-model="state.query"
        type="search"
        label="搜索歌曲、歌手或专辑"
        placeholder="搜索歌曲、歌手或专辑…"
        class="min-h-11 flex-1 border-0 bg-transparent px-1 text-sm focus-visible:outline-none"
        @keydown.enter.prevent="results[0] && select(results[0])"
        @keydown.esc.stop.prevent="emit('close')"
      />
      <UiIconButton
        icon="x"
        label="关闭搜索"
        @click="emit('close')"
      />
    </header>
    <div class="max-h-[min(440px,calc(100dvh-200px))] overflow-y-auto p-3">
      <template v-if="state.query.trim()">
        <p
          class="px-3 pt-2 pb-3 text-caption tracking-wide text-muted"
          role="status"
        >
          找到 {{ results.length }} 首音乐
        </p>
        <button
          v-for="track in results"
          :key="track.id"
          type="button"
          class="flex w-full items-center gap-4 rounded-input px-3 py-3 text-left hover:bg-hover focus-visible:bg-hover"
          :aria-label="`${track.demo ? '预览' : '播放'} ${track.title} · ${track.artist}`"
          @click="select(track)"
        >
          <span
            class="size-12 shrink-0 overflow-hidden rounded-input border border-line"
          >
            <Artwork
              :artwork="track.artwork"
              :src="track.coverRef"
              :title="track.title"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm">{{ track.title }}</span>
            <span class="mt-1 block truncate text-label text-muted"
              >{{ track.artist }} · {{ track.album }}</span
            >
          </span>
          <AppIcon
            :name="
              snapshot.trackId === track.id
                ? 'music-2'
                : track.demo
                  ? 'arrow-up-right'
                  : 'play'
            "
            :size="16"
            class="shrink-0 text-muted"
          />
        </button>
        <p
          v-if="!results.length"
          class="px-5 py-12 text-center text-sm text-muted"
        >
          没有找到这首音乐，试试其他歌曲、歌手或专辑名称。
        </p>
      </template>
      <div
        v-else
        class="px-5 py-12 text-center"
      >
        <p class="font-display text-xl">寻找下一首心动的声音</p>
        <p class="mt-3 text-label text-muted">
          输入歌曲、歌手或专辑名称，搜索你的音乐空间。
        </p>
      </div>
    </div>
    <footer
      class="flex justify-between border-t border-line px-6 py-3 text-caption text-muted"
    >
      <span>Enter 播放首个结果</span><span>Esc 关闭</span>
    </footer>
  </UiDialog>
</template>
