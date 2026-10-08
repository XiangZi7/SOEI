<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { UiButton, UiIconButton, UiPanel, UiSelect } from '../../components/ui'
import Artwork from '../../components/ui/Artwork.vue'
import { formatTime } from '../lyrics/lrc'
const store = useMusicStore()
const { queueTracks, snapshot, preferences } = storeToRefs(store)
defineEmits<{ close: [] }>()
function remove(id: string) {
  void store.setQueue(store.snapshot.queue.filter(item => item !== id))
}
function move(index: number, direction: number) {
  const queue = [...store.snapshot.queue]
  const next = index + direction
  if (next < 0 || next >= queue.length) return
  ;[queue[index], queue[next]] = [queue[next]!, queue[index]!]
  void store.setQueue(queue)
}
function addToPlaylist(trackId: string, event: Event) {
  const playlist = store.preferences.playlists.find(
    playlist => playlist.id === (event.target as HTMLSelectElement).value
  )
  if (playlist && !playlist.trackIds.includes(trackId))
    playlist.trackIds.push(trackId)
  ;(event.target as HTMLSelectElement).value = ''
}
</script>

<template>
  <UiPanel
    class="w-[min(440px,calc(100vw-2.5rem))] p-6"
    role="complementary"
    aria-label="播放队列"
  >
    <div class="mb-5 flex items-start justify-between">
      <div>
        <p class="eyebrow">UP NEXT</p>
        <h2 class="my-2.5 font-display text-2xl">
          播放队列
          <small class="ml-2 font-ui text-label text-muted">{{
            queueTracks.length
          }}</small>
        </h2>
      </div>
      <UiIconButton
        icon="x"
        label="关闭播放队列"
        @click="$emit('close')"
      />
    </div>
    <div class="max-h-[50vh] overflow-y-auto">
      <div
        v-for="(track, index) in queueTracks"
        :key="track.id + '-' + index"
        class="flex flex-wrap items-center gap-1 border-b border-line py-2.5"
        :class="{ 'text-accent': snapshot.trackId === track.id }"
      >
        <UiButton
          variant="ghost"
          class="min-w-0 flex-1 justify-start gap-3 px-0 text-left"
          @click="store.select(track)"
          ><span class="size-9 shrink-0"
            ><Artwork
              :src="track.coverRef"
              :title="track.title" /></span
          ><span class="truncate-text font-display text-sm"
            >{{ track.title
            }}<small class="mt-1 block font-ui text-[9px] text-muted"
              >{{ track.artist }} · {{ formatTime(track.durationMs) }}</small
            ></span
          ></UiButton
        >
        <div class="flex">
          <UiIconButton
            class="h-8 w-7"
            icon="chevron-up"
            :icon-size="13"
            :disabled="index === 0"
            label="向前移动"
            @click="move(index, -1)"
          /><UiIconButton
            class="h-8 w-7"
            icon="chevron-down"
            :icon-size="13"
            :disabled="index === queueTracks.length - 1"
            label="向后移动"
            @click="move(index, 1)"
          /><UiIconButton
            class="h-8 w-7"
            icon="x"
            :icon-size="13"
            :label="'从队列移除 ' + track.title"
            @click="remove(track.id)"
          />
        </div>
        <UiSelect
          v-if="preferences.playlists.length"
          class="ml-12 text-caption"
          :label="'将 ' + track.title + ' 加入播放列表'"
          @change="addToPlaylist(track.id, $event)"
          ><option value="">加入列表</option>
          <option
            v-for="playlist in preferences.playlists"
            :key="playlist.id"
            :value="playlist.id"
          >
            {{ playlist.name }}
          </option></UiSelect
        >
      </div>
      <p
        v-if="!queueTracks.length"
        class="py-8 text-label text-muted"
      >
        选择一首本地音乐，开始你的聆听。
      </p>
    </div>
    <UiButton
      class="mt-5 w-full text-[11px]"
      :disabled="!queueTracks.length"
      @click="store.setQueue([])"
      >清空队列并停止播放</UiButton
    >
  </UiPanel>
</template>
