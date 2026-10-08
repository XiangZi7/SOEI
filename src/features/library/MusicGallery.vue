<script setup lang="ts">
import { computed, reactive, toRefs, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { AppIcon, UiButton, UiInput } from '../../components/ui'
import CoverCard from './CoverCard.vue'
import CollectionCard from './CollectionCard.vue'
import type { Track } from '../../types/music'
const store = useMusicStore()
defineProps<{ testLoading?: boolean }>()
const {
  filteredTracks,
  tracks,
  realTracks,
  tab,
  query,
  favoritesOnly,
  recentOnly,
  preferences,
  snapshot,
  previewId,
} = storeToRefs(store)
defineEmits<{
  select: [track: Track]
  preview: [track: Track | null]
  import: [directory: boolean]
  test: []
  scene: [preview: boolean]
}>()
// 响应式状态
const state = reactive({
  // 分类内打开的分组
  openGroup: '',
  // 新播放列表名称
  playlistName: '',
})
const { openGroup, playlistName } = toRefs(state)
const featured = computed(
  () =>
    !realTracks.value.length &&
    tab.value === 'all' &&
    !query.value &&
    !favoritesOnly.value &&
    !recentOnly.value
)
const groups = computed(() => {
  if (tab.value === 'playlists')
    return preferences.value.playlists.map(playlist => ({
      name: playlist.name,
      id: playlist.id,
      tracks: tracks.value.filter(track =>
        playlist.trackIds.includes(track.id)
      ),
    }))
  const field = tab.value === 'artists' ? 'artist' : 'album'
  const map = new Map<string, Track[]>()
  filteredTracks.value.forEach(track => {
    const group = map.get(track[field]) ?? []
    group.push(track)
    map.set(track[field], group)
  })
  return [...map].map(([name, tracks]) => ({ name, id: name, tracks }))
})
const groupTracks = computed(
  () => groups.value.find(group => group.id === state.openGroup)?.tracks ?? []
)
function addPlaylist() {
  store.createPlaylist(state.playlistName)
  state.playlistName = ''
}
function resetFilters() {
  store.query = ''
  store.favoritesOnly = false
  store.recentOnly = false
}
watch(tab, () => {
  state.openGroup = ''
})
</script>
<template>
  <section
    class="music-gallery w-full px-7 max-sm:px-4.5"
    aria-label="音乐封面画廊"
  >
    <div
      v-if="tab !== 'all' || query || favoritesOnly || recentOnly"
      class="mb-5 flex min-h-7 items-center justify-between gap-5"
    >
      <p class="eyebrow max-[850px]:hidden">
        {{
          realTracks.length ? 'YOUR PERSONAL UNIVERSE' : 'A UNIVERSE OF SOUNDS'
        }}<span
          class="ml-5.5 font-ui text-[8px] tracking-wider text-muted max-lg:hidden"
          >{{ filteredTracks.length.toString().padStart(2, '0') }}
          {{ realTracks.length ? 'TRACKS' : 'VISUAL STUDIES' }}</span
        >
      </p>
      <div
        class="collection-actions flex items-center gap-3 max-[850px]:w-full max-[850px]:justify-end"
      >
        <UiButton
          variant="ghost"
          class="flex min-h-8 items-center gap-1.5 text-caption text-muted hover:text-ink"
          :class="{ active: recentOnly }"
          :aria-pressed="recentOnly"
          @click="recentOnly = !recentOnly"
          >最近播放</UiButton
        >
        <UiButton
          variant="ghost"
          class="flex min-h-8 items-center gap-1.5 text-caption text-muted hover:text-ink"
          :class="{ active: favoritesOnly }"
          :aria-pressed="favoritesOnly"
          @click="favoritesOnly = !favoritesOnly"
          ><AppIcon
            name="heart"
            :size="12"
          />收藏</UiButton
        >
        <UiButton
          variant="ghost"
          class="flex min-h-8 items-center gap-1.5 text-caption text-accent"
          @click="$emit('import', false)"
          ><AppIcon
            name="plus"
            :size="14"
          />导入音乐</UiButton
        >
        <UiButton
          variant="ghost"
          class="-ml-3 size-7"
          aria-label="导入音乐目录"
          @click="$emit('import', true)"
          ><AppIcon
            name="folder-open"
            :size="15"
        /></UiButton>
      </div>
    </div>

    <div
      v-if="tab === 'playlists' && !openGroup"
      class="my-5 mb-11 flex gap-4"
    >
      <UiInput
        v-model="playlistName"
        label="新播放列表名称"
        class="w-65 max-sm:w-3/5"
        placeholder="给新的播放列表起个名字"
        maxlength="80"
        @keydown.enter="addPlaylist"
      />
      <UiButton
        variant="ghost"
        class=""
        :disabled="!playlistName.trim()"
        @click="addPlaylist"
        ><AppIcon
          name="plus"
          :size="14"
        />新建列表</UiButton
      >
    </div>

    <div
      v-if="tab !== 'all' && !openGroup"
      class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] items-start gap-x-10 gap-y-8 max-sm:grid-cols-2 max-sm:gap-x-5"
    >
      <CollectionCard
        v-for="group in groups"
        :key="group.id"
        :name="group.name"
        :tracks="group.tracks"
        @select="openGroup = group.id"
      />
    </div>
    <template v-else>
      <div
        v-if="openGroup && tab !== 'all'"
        class="mb-7 flex items-center gap-2.5 font-display text-2xl"
      >
        <UiButton
          variant="ghost"
          class="icon-button"
          aria-label="返回分类"
          @click="openGroup = ''"
          ><AppIcon name="arrow-left" /></UiButton
        ><span>{{ groups.find(group => group.id === openGroup)?.name }}</span>
      </div>
      <div
        class="cover-grid"
        :class="{ 'featured-grid': featured }"
      >
        <CoverCard
          v-for="track in tab === 'all' ? filteredTracks : groupTracks"
          :key="track.id"
          :track="track"
          :featured="featured && track.id === previewId"
          :show-title="preferences.showTitles"
          :playing="
            snapshot.trackId === track.id && snapshot.status === 'playing'
          "
          @select="$emit('select', $event)"
          @favorite="store.favorite"
          @preview="$emit('preview', $event)"
        />
      </div>
    </template>

    <div
      v-if="!filteredTracks.length || (tab === 'playlists' && !groups.length)"
      class="grid place-items-center px-5 py-16 text-center"
    >
      <span
        class="mb-5 grid size-20 place-items-center rounded-full border border-line text-accent"
        ><AppIcon
          :name="query ? 'search' : 'music-2'"
          :size="25"
      /></span>
      <h2 class="my-4 font-display text-2xl">
        {{
          query
            ? '还没有找到这首音乐'
            : favoritesOnly
              ? '把喜欢的声音留在这里'
              : recentOnly
                ? '每一次聆听，都会留下痕迹'
                : '你的音乐空间，等待第一首歌'
        }}
      </h2>
      <p class="mb-6 text-label text-muted">
        {{
          query
            ? '试试歌曲、歌手或专辑的其他名字。'
            : '导入本地音乐，让封面和歌词成为你的风景。'
        }}
      </p>
      <UiButton
        variant="ghost"
        v-if="query || favoritesOnly || recentOnly"
        class=""
        @click="resetFilters"
        >查看所有音乐</UiButton
      >
      <UiButton
        variant="ghost"
        v-else
        class=""
        @click="$emit('import', false)"
        >选择音乐文件</UiButton
      >
    </div>
    <footer
      class="gallery-footer flex items-center justify-between gap-4 pt-5 pb-3"
    >
      <span class="font-display text-[10px] tracking-[.16em] text-muted"
        >{{ filteredTracks.length.toString().padStart(2, '0') }}
        {{ realTracks.length ? 'TRACKS' : 'VISUAL STUDIES' }}</span
      >
      <span
        v-if="!realTracks.length"
        class="text-[9px] tracking-wide text-muted max-sm:hidden"
        >点击封面，走进音乐的世界。</span
      >
      <span class="font-display text-[11px] tracking-wider text-muted"
        ><button
          class="flex min-h-8 items-center gap-2 hover:text-ink"
          :disabled="testLoading"
          @click="$emit('test')"
        >
          <AppIcon
            :name="testLoading ? 'loader-circle' : 'play'"
            :size="12"
            :class="{ 'animate-spin': testLoading }"
          />{{ testLoading ? '正在准备…' : '播放测试' }}
        </button></span
      >
    </footer>
  </section>
</template>
<style scoped>
.cover-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 22px 20px;
}
.collection-actions .active {
  color: var(--color-ink);
  text-decoration: underline;
  text-underline-offset: 6px;
}
@media (max-width: 1100px) {
  .cover-grid {
    gap: 20px 16px;
  }
}
@media (max-width: 850px) {
  .cover-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }
}
@media (max-width: 500px) {
  .cover-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
}
</style>
