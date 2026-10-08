<script setup lang="ts">
import { computed, reactive, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn,
  usePreferredReducedMotion,
} from '@vueuse/core'
import { useMusicStore } from '../../stores/music'
import { lyricIndexAt } from '../lyrics/lrc'
import SceneBackdrop from './SceneBackdrop.vue'
import LyricStage from './LyricStage.vue'
import { previewLyrics, sceneModes } from './sceneModes'
import { shotPalette, shotVariant } from './lyricStoryboard'
import PlaybackSeekBar from '../player/PlaybackSeekBar.vue'
import PlaybackTransport from '../player/PlaybackTransport.vue'
import { UiIconButton, UiSlider } from '../../components/ui'

const props = defineProps<{
  preview?: boolean
  wallpaper?: boolean
  showcase?: boolean
}>()
defineEmits<{ queue: []; fullscreen: []; close: [] }>()
const store = useMusicStore()
const { activeTrack, previewTrack, lyrics, snapshot, preferences } =
  storeToRefs(store)
const systemMotion = usePreferredReducedMotion()
const scene = useTemplateRef<HTMLElement>('scene')
const visible = useElementVisibility(scene)
const documentVisibility = useDocumentVisibility()
const state = reactive({
  // 视觉预览独立循环，不修改播放进度或真实歌词。
  previewIndex: 1,
})
const track = computed(() =>
  props.preview ? previewTrack.value : activeTrack.value
)
const wallpaperCover = computed(
  () => props.wallpaper || store.wallpaper.enabled.length > 0
)
const background = computed(
  () =>
    (track.value && preferences.value.trackBackgrounds[track.value.id]) ||
    preferences.value.background
)
const video = computed(() => /\.(mp4|webm)$/i.test(background.value))
const reducedMotion = computed(
  () => preferences.value.reducedMotion || systemMotion.value === 'reduce'
)
const animated = computed(
  () =>
    (props.preview || snapshot.value.status === 'playing') &&
    visible.value &&
    documentVisibility.value === 'visible'
)
const lines = computed(() => (props.preview ? previewLyrics : lyrics.value))
const lyricIndex = computed(() =>
  props.preview
    ? state.previewIndex
    : lyricIndexAt(
        lyrics.value,
        snapshot.value.positionMs +
          preferences.value.lyricOffset +
          (track.value
            ? (preferences.value.trackOffsets[track.value.id] ?? 0)
            : 0)
      )
)
const { pause, resume } = useIntervalFn(
  () => {
    state.previewIndex = (state.previewIndex + 1) % previewLyrics.length
  },
  4000,
  { immediate: false }
)
watch(
  () =>
    props.preview &&
    visible.value &&
    documentVisibility.value === 'visible' &&
    !reducedMotion.value &&
    preferences.value.quality !== 'power',
  running => {
    if (running) resume()
    else pause()
  },
  { immediate: true }
)
const variant = computed(() =>
  shotVariant(
    track.value?.id ?? 'empty',
    lyricIndex.value,
    preferences.value.sceneSeed
  )
)
const palette = computed(() =>
  shotPalette(preferences.value.layout, variant.value)
)
const mode = computed(
  () =>
    sceneModes.find(mode => mode.id === preferences.value.layout) ??
    sceneModes[0]!
)
const color = computed(() =>
  preferences.value.layout === 'montage' ||
  preferences.value.layout === 'collage'
    ? palette.value.glow
    : (track.value?.color ?? '#718bae')
)
const energy = computed(() =>
  preferences.value.quality === 'power' || reducedMotion.value
    ? 0
    : (snapshot.value.energy[0] ?? 0)
)
function backgroundFailed() {
  store.report('视频背景无法播放，已回退到静态封面')
  if (track.value) delete preferences.value.trackBackgrounds[track.value.id]
  preferences.value.background = ''
}
const seek = (positionMs: number) =>
  store.command('seek', { value: positionMs })
function volume(event: Event) {
  void store.command('volume', {
    value: Number((event.target as HTMLInputElement).value),
  })
}
</script>

<template>
  <section
    ref="scene"
    class="immersive-scene absolute inset-0 overflow-hidden bg-stage"
    :class="{ 'wallpaper-scene': wallpaper, 'reduced-motion': reducedMotion }"
    :style="{
      '--lyric-size': `${preferences.lyricSize}px`,
      '--stage-color': color,
      '--color-stage-gold': palette.accent,
      '--color-stage-muted': palette.muted,
    }"
    aria-label="沉浸式音乐场景"
  >
    <SceneBackdrop
      :track-key="track?.id"
      :artwork="track?.artwork"
      :cover="track?.coverRef"
      :background="background"
      :video="video"
      :color="color"
      :layout="preferences.layout"
      :variant="variant"
      :animated="animated"
      :reduced-motion="reducedMotion"
      :quality="preferences.quality"
      :energy="energy"
      @background-failed="backgroundFailed"
    />
    <div
      v-if="!wallpaper"
      class="absolute flex items-center gap-3 text-[9px] tracking-[.2em] text-stage-muted"
      :class="
        showcase
          ? 'top-[10%] left-[5%]'
          : 'top-[14%] left-[10%] max-sm:top-[16%] max-sm:left-[7%]'
      "
    >
      <span class="h-px w-7 bg-stage-gold/70" />{{
        preview ? 'SOEI / 视觉预览' : 'SOEI / 歌词舞台'
      }}
    </div>
    <LyricStage
      :track="track"
      :lines="lines"
      :index="lyricIndex"
      :layout="preferences.layout"
      :seed="preferences.sceneSeed"
      :animated="animated"
      :reduced-motion="reducedMotion || preferences.quality === 'power'"
      :showcase="showcase"
      :energy="preview ? [] : snapshot.energy"
      :wallpaper-cover="wallpaperCover"
    >
      <template
        v-if="!showcase"
        #cover-progress
      >
        <PlaybackSeekBar
          :snapshot="snapshot"
          :disabled="preview || !track || !snapshot.durationMs"
          :preview="preview"
          :seek="seek"
        />
      </template>
      <template
        v-if="!showcase"
        #cover-controls
      >
        <PlaybackTransport
          expanded
          :preview="preview"
          @queue="$emit('queue')"
          @fullscreen="$emit('fullscreen')"
        />
      </template>
      <template
        v-if="!wallpaper && !showcase"
        #cover-window
      >
        <div class="cover-window-actions">
          <details class="cover-volume">
            <summary
              aria-label="调整音量"
              title="调整音量"
            >
              <svg
                viewBox="0 0 20 20"
                width="12"
                height="12"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M2 7h3l5-4v14l-5-4H2z"
                />
                <path
                  fill="none"
                  stroke="currentColor"
                  d="M13 5a7 7 0 0 1 0 10"
                />
              </svg>
            </summary>
            <div class="cover-volume-panel">
              <UiIconButton
                :icon="snapshot.volume ? 'volume-2' : 'volume-x'"
                :icon-size="14"
                :label="snapshot.volume ? '静音' : '取消静音'"
                :disabled="preview"
                @click="
                  store.command('volume', { value: snapshot.volume ? 0 : 0.65 })
                "
              /><UiSlider
                label="音量"
                :max="1"
                :step="0.01"
                :model-value="snapshot.volume"
                :disabled="preview"
                @input="volume"
              />
            </div>
          </details>
          <UiIconButton
            icon="maximize"
            :icon-size="12"
            label="切换全屏"
            @click="$emit('fullscreen')"
          />
          <UiIconButton
            icon="x"
            :icon-size="12"
            label="关闭封面场景"
            @click="$emit('close')"
          />
        </div>
      </template>
    </LyricStage>
    <div
      v-if="
        !wallpaper &&
        !showcase &&
        !(preferences.layout === 'title' && wallpaperCover)
      "
      class="absolute bottom-[20%] left-[10%] flex flex-col gap-2 text-sm max-sm:bottom-[23%] max-sm:left-[7%]"
    >
      <span>{{ track?.title }}</span
      ><small class="text-caption text-stage-muted">{{
        preview ? '视觉预览 · 无音频' : track?.artist
      }}</small>
    </div>
    <div
      v-if="!wallpaper"
      class="absolute flex items-center gap-3.5 text-[9px] tracking-wider text-stage-muted"
      :class="
        showcase
          ? 'right-[5%] bottom-[8%]'
          : 'right-[7%] bottom-[20%] max-sm:bottom-[23%]'
      "
    >
      <span class="font-display text-[28px] text-stage-gold/65 italic">{{
        mode.number
      }}</span
      ><span class="max-sm:hidden"
        >{{ mode.name }} / {{ mode.description }}</span
      >
    </div>
  </section>
</template>

<style scoped>
/* 壁纸复用同一舞台，仅移除控制层预留的区域。 */
.wallpaper-scene :deep(.lyric-stage) {
  inset: 20% 10%;
}
.cover-window-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.cover-window-actions > button {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  color: #a2aa9c;
}
.cover-volume {
  position: relative;
}
.cover-volume summary {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  list-style: none;
}
.cover-volume summary::-webkit-details-marker {
  display: none;
}
.cover-volume summary:focus-visible {
  outline: 1px solid var(--color-focus);
}
.cover-volume-panel {
  position: absolute;
  top: 26px;
  right: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  width: 145px;
  padding: 8px;
  border: 1px solid #b8c4bc35;
  border-radius: 4px;
  background: #0a100df5;
}
.cover-volume-panel input {
  width: 85px;
}
</style>
