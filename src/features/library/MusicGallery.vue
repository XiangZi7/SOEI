<script setup lang="ts">
import { computed, reactive, toRefs, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { AppIcon, UiButton, UiInput } from '../../components/ui'
import CoverCard from './CoverCard.vue'
import Artwork from '../../components/ui/Artwork.vue'
import SceneShowcase from './SceneShowcase.vue'
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
} = storeToRefs(store)
defineEmits<{
  select: [track: Track]
  preview: [track: Track | null]
  import: [directory: boolean]
  test: []
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
    class="mx-auto w-full max-w-450 px-6 sm:px-[5vw] xl:px-[7.3vw]"
    aria-label="音乐封面画廊"
  >
    <SceneShowcase
      v-if="tab === 'all' && !query && !favoritesOnly && !recentOnly"
      :test-loading="testLoading"
      @test="$emit('test')"
      @preview="$emit('select', store.previewTrack)"
    />
    <div class="mt-2 mb-9 flex min-h-7 items-center justify-between gap-5">
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
      class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-10"
    >
      <UiButton
        variant="ghost"
        v-for="group in groups"
        :key="group.id"
        class="group max-w-55 flex-col items-stretch p-0 text-left"
        @click="openGroup = group.id"
      >
        <span
          class="mb-4 block aspect-square w-full border border-line transition-transform duration-(--motion-hover) group-hover:-translate-y-1"
          ><Artwork
            :artwork="group.tracks[0]?.artwork"
            :src="group.tracks[0]?.coverRef"
            :title="group.name"
        /></span>
        <span class="block font-display text-xl">{{ group.name }}</span
        ><span class="mt-2 block text-caption text-muted"
          >{{ group.tracks.length }} 首音乐</span
        >
      </UiButton>
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
          :featured="featured && track.id === 'demo-7'"
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
      class="flex flex-wrap items-center justify-between gap-5 pt-12 pb-8"
    >
      <span
        class="font-display text-[8px] leading-relaxed tracking-[.24em] text-muted"
        >EVERY SONG.<br />ANOTHER WORLD.</span
      >
      <span
        v-if="!realTracks.length"
        class="text-[9px] tracking-wide text-muted max-[850px]:order-3 max-[850px]:w-full"
        >示例画廊 · 点击封面预览视觉，导入音乐开始聆听</span
      >
      <span
        class="font-display text-[11px] tracking-widest text-muted max-sm:text-[9px]"
        lang="ja"
        >音楽で、まだ見ぬ景色へ。</span
      >
    </footer>
  </section>
</template>
<style scoped>
.cover-grid {
  --cover-size: clamp(120px, 12.5vw, 190px);
  display: grid;
  grid-template-columns: repeat(5, var(--cover-size));
  justify-content: space-between;
  gap: clamp(28px, 3.2vw, 48px) 30px;
}
.collection-actions .active {
  color: var(--color-ink);
  text-decoration: underline;
  text-underline-offset: 6px;
}
@media (min-width: 1700px) {
  .cover-grid {
    --cover-size: 205px;
  }
}
@media (max-width: 1100px) {
  .cover-grid {
    --cover-size: 14.5vw;
    column-gap: 16px;
  }
}
@media (max-width: 850px) {
  .cover-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 25px;
  }
}
@media (max-width: 500px) {
  .cover-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px;
  }
}
</style>
