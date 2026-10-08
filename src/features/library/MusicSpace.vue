<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  toRefs,
  useTemplateRef,
  watch,
} from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { call, desktop, onNative } from '../../bridge/native'
import { AppIcon, UiButton, UiIconButton, UiInput } from '../../components/ui'
import SpaceHeader from './SpaceHeader.vue'
import MusicGallery from './MusicGallery.vue'
import PlayerControls from '../player/PlayerControls.vue'
import QueuePanel from '../player/QueuePanel.vue'
import ImmersiveScene from '../visual/ImmersiveScene.vue'
import SettingsDialog from '../settings/SettingsDialog.vue'
import type { Track } from '../../types/music'
const store = useMusicStore()
const { activeTrack, preferences, query, error, notice, scan } =
  storeToRefs(store)
// 响应式状态
const state = reactive({
  // 沉浸场景开关
  sceneOpen: false,
  // 当前场景是无音频的示例
  scenePreview: false,
  // 设置弹层开关
  settingsOpen: false,
  // 设置初始分类
  settingsCategory: 'general',
  // 搜索框开关
  searchOpen: false,
  // 队列面板开关
  queueOpen: false,
  // 全屏模式状态
  fullscreen: false,
  // 控制层可见性
  controlsVisible: true,
  // 控制层鼠标悬停状态
  controlsHovered: false,
  // 聚焦封面的环境颜色
  ambientColor: 'var(--color-ambient-default)',
})
const {
  sceneOpen,
  scenePreview,
  settingsOpen,
  settingsCategory,
  searchOpen,
  queueOpen,
  fullscreen,
  controlsVisible,
  ambientColor,
  controlsHovered,
} = toRefs(state)
const musicInput = useTemplateRef<HTMLInputElement>('musicInput')
const lyricInput = useTemplateRef<HTMLInputElement>('lyricInput')
const searchInput = useTemplateRef<InstanceType<typeof UiInput>>('searchInput')
let hideTimer: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let ambientTimer: ReturnType<typeof setTimeout> | undefined
let trayCleanup: (() => void) | undefined

function importMusic(directory = false) {
  if (desktop) void store.importMusic(directory)
  else musicInput.value?.click()
}
function filesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  store.importBrowserFiles(input.files)
  input.value = ''
}
async function lyricsSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    store.lyricText = await file.text()
    store.notice = '歌词已导入'
  }
  input.value = ''
}
function importLyrics() {
  if (desktop) void store.importLyrics()
  else lyricInput.value?.click()
}
async function select(track: Track) {
  await store.select(track)
  if (track.demo || store.snapshot.trackId === track.id) {
    state.scenePreview = !!track.demo
    state.sceneOpen = true
    revealControls()
  }
}
function openCurrentScene() {
  state.scenePreview = false
  state.sceneOpen = true
  revealControls()
}
function preview(track: Track | null) {
  clearTimeout(ambientTimer)
  ambientTimer = setTimeout(() => {
    state.ambientColor = track?.color ?? 'var(--color-ambient-default)'
  }, 80)
}
async function toggleSearch() {
  state.searchOpen = !state.searchOpen
  if (state.searchOpen) {
    await nextTick()
    searchInput.value?.focus()
  } else store.query = ''
}
function settings(category = 'general') {
  state.settingsCategory = category
  state.settingsOpen = true
}
async function toggleFullscreen() {
  try {
    if (desktop) {
      await call('window_action', { action: 'fullscreen' })
      state.fullscreen = !state.fullscreen
    } else if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch (error) {
    store.report(error)
  }
}
function revealControls() {
  state.controlsVisible = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (
      state.sceneOpen &&
      !state.controlsHovered &&
      !state.settingsOpen &&
      !state.queueOpen &&
      !(
        document.activeElement instanceof HTMLElement &&
        document.activeElement.closest('.scene-controls')
      )
    )
      state.controlsVisible = false
  }, 3000)
}
function leaveControls() {
  state.controlsHovered = false
  revealControls()
}
function dismissNotification() {
  store.error = ''
  store.notice = ''
}
function keyboard(event: KeyboardEvent) {
  const target = event.target
  const interactive =
    target instanceof HTMLElement &&
    !!target.closest('input,textarea,select,button,[contenteditable=true]')
  if (event.key === 'Escape') {
    if (state.settingsOpen) return
    if (state.queueOpen) state.queueOpen = false
    else if (state.fullscreen) void toggleFullscreen()
    else if (state.sceneOpen) state.sceneOpen = false
    else if (state.searchOpen) {
      state.searchOpen = false
      store.query = ''
    }
    event.preventDefault()
  } else if (
    event.code === 'Space' &&
    !interactive &&
    !state.settingsOpen &&
    !state.scenePreview
  ) {
    event.preventDefault()
    void store.command('toggle')
  } else if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === 'k'
  ) {
    event.preventDefault()
    void toggleSearch()
  }
  revealControls()
}
function fullscreenChange() {
  state.fullscreen = !!document.fullscreenElement
}
watch(notice, () => {
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    store.notice = ''
  }, 6000)
})
onMounted(async () => {
  window.addEventListener('keydown', keyboard)
  document.addEventListener('fullscreenchange', fullscreenChange)
  await store.initialize()
  if (desktop)
    trayCleanup = await onNative('ui:wallpaper', () => settings('display'))
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keyboard)
  document.removeEventListener('fullscreenchange', fullscreenChange)
  clearTimeout(hideTimer)
  clearTimeout(noticeTimer)
  clearTimeout(ambientTimer)
  trayCleanup?.()
})
</script>
<template>
  <main
    class="music-space relative isolate min-h-dvh"
    :class="{
      'reduced-motion': preferences.reducedMotion,
      'has-player': activeTrack,
    }"
    :style="{ '--ambient-color': ambientColor }"
  >
    <div
      class="ambient-background pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      <span class="ambient-beam" /><span class="ambient-reflection" />
    </div>
    <div
      v-if="desktop && !fullscreen"
      class="window-strip relative z-(--z-controls) flex h-6 items-center justify-between pl-4 text-muted select-none"
      @mousedown.self="
        call('window_action', { action: 'drag' }).catch(store.report)
      "
    >
      <span class="pointer-events-none text-[8px] tracking-[.22em]">SOEI</span>
      <div>
        <UiButton
          variant="ghost"
          aria-label="最小化窗口"
          @click="
            call('window_action', { action: 'minimize' }).catch(store.report)
          "
          ><AppIcon
            name="minus"
            :size="12" /></UiButton
        ><UiButton
          variant="ghost"
          aria-label="最大化窗口"
          @click="
            call('window_action', { action: 'maximize' }).catch(store.report)
          "
          ><AppIcon
            name="square"
            :size="10" /></UiButton
        ><UiButton
          variant="ghost"
          class="window-close"
          aria-label="关闭窗口"
          @click="
            call('window_action', { action: 'close' }).catch(store.report)
          "
          ><AppIcon
            name="x"
            :size="13"
        /></UiButton>
      </div>
    </div>
    <div
      v-show="!sceneOpen"
      class="library-view"
    >
      <SpaceHeader
        @search="toggleSearch"
        @settings="settings()"
        @import="importMusic()"
      />
      <Transition name="fade"
        ><div
          v-if="searchOpen"
          class="mx-auto mb-7 flex w-[min(650px,85%)] items-center gap-4 rounded-input border border-line bg-surface py-1 pr-2.5 pl-5"
        >
          <AppIcon
            name="search"
            :size="18"
          /><UiInput
            ref="searchInput"
            v-model="query"
            label="搜索歌曲、歌手或专辑"
            placeholder="搜索歌曲、歌手或专辑…"
            class="flex-1 border-0 bg-transparent px-0 text-sm"
          /><span
            class="rounded-input border border-line px-1.5 py-0.5 text-[8px] text-muted"
            >ESC</span
          ><UiIconButton
            icon="x"
            label="关闭搜索"
            @click="toggleSearch"
            :icon-size="15"
          /></div
      ></Transition>
      <MusicGallery
        @select="select"
        @preview="preview"
        @import="importMusic"
      />
    </div>
    <Transition name="scene"
      ><div
        v-if="sceneOpen"
        class="fixed inset-0 z-(--z-scene)"
        @pointermove="revealControls"
        @touchstart="revealControls"
      >
        <ImmersiveScene :preview="scenePreview" />
        <div
          class="scene-controls absolute top-15 right-[5.5%] left-[5.5%] flex justify-between max-sm:top-6"
          :class="{ 'controls-hidden': !controlsVisible }"
          @pointerenter="controlsHovered = true"
          @pointerleave="leaveControls"
          @focusin="revealControls"
        >
          <UiButton
            variant="ghost"
            class="border-0 bg-glass text-[11px]"
            @click="sceneOpen = false"
            ><AppIcon
              name="arrow-left"
              :size="15"
            />音乐空间</UiButton
          >
          <div class="flex items-center gap-5 max-sm:gap-3">
            <UiButton
              variant="ghost"
              class="scene-layout min-h-10 font-display text-[9px] tracking-widest text-muted"
              :class="{ active: preferences.layout === 'artistic' }"
              @click="preferences.layout = 'artistic'"
              >LYRICS</UiButton
            ><UiButton
              variant="ghost"
              class="scene-layout min-h-10 font-display text-[9px] tracking-widest text-muted"
              :class="{ active: preferences.layout === 'title' }"
              @click="preferences.layout = 'title'"
              >TITLE</UiButton
            ><UiIconButton
              icon="settings-2"
              label="场景设置"
              @click="settings('visual')"
              :icon-size="17"
            />
          </div>
        </div>
        <div
          class="scene-controls absolute right-[5.5%] bottom-9 left-[5.5%] max-sm:right-[4%] max-sm:bottom-5 max-sm:left-[4%]"
          :class="{ 'controls-hidden': !controlsVisible }"
          @pointerenter="controlsHovered = true"
          @pointerleave="leaveControls"
          @focusin="revealControls"
        >
          <PlayerControls
            :preview="scenePreview"
            @queue="queueOpen = !queueOpen"
            @fullscreen="toggleFullscreen"
            @scene="settings('lyrics')"
          />
        </div></div
    ></Transition>
    <Transition name="fade"
      ><div
        v-if="activeTrack && !sceneOpen"
        class="fixed right-[5%] bottom-5 left-[5%] z-(--z-controls) max-sm:right-[3%] max-sm:bottom-3 max-sm:left-[3%]"
      >
        <PlayerControls
          compact
          @scene="openCurrentScene"
          @queue="queueOpen = !queueOpen"
          @fullscreen="toggleFullscreen"
        /></div
    ></Transition>
    <Transition name="fade"
      ><div
        v-if="queueOpen"
        class="fixed right-[5%] bottom-28 z-(--z-popover) max-sm:right-[3%] max-sm:bottom-32"
      >
        <QueuePanel @close="queueOpen = false" /></div
    ></Transition>
    <SettingsDialog
      v-if="settingsOpen"
      :initial-category="settingsCategory"
      @close="settingsOpen = false"
      @lyrics="importLyrics"
    />
    <div
      v-if="scan.running"
      class="scan-toast glass-panel fixed bottom-28 left-[5%] z-(--z-notification) flex max-w-[min(500px,90vw)] items-center gap-3 rounded-input py-1.5 pr-2.5 pl-4 text-[11px]"
      role="status"
    >
      <AppIcon
        name="loader-circle"
        class="animate-spin"
      /><span>正在扫描 · 已导入 {{ scan.imported }} 首</span
      ><UiIconButton
        icon="x"
        label="取消扫描"
        @click="call('library_cancel').catch(store.report)"
        :icon-size="14"
      />
    </div>
    <Transition name="fade"
      ><div
        v-if="error || notice"
        class="notification glass-panel fixed top-25 left-1/2 z-(--z-notification) flex max-w-[min(500px,90vw)] -translate-x-1/2 items-center gap-3 rounded-input py-1.5 pr-2.5 pl-4 text-[11px] max-sm:top-19"
        :class="{ 'is-error': error }"
        :role="error ? 'alert' : 'status'"
      >
        <AppIcon
          :name="error ? 'circle-alert' : 'check'"
          :size="16"
        /><span>{{ error || notice }}</span
        ><UiIconButton
          icon="x"
          label="关闭提示"
          @click="dismissNotification"
          :icon-size="14"
        /></div
    ></Transition>
    <input
      ref="musicInput"
      class="sr-only"
      tabindex="-1"
      type="file"
      accept="audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac"
      multiple
      @change="filesSelected"
    />
    <input
      ref="lyricInput"
      class="sr-only"
      tabindex="-1"
      type="file"
      accept=".lrc"
      @change="lyricsSelected"
    />
  </main>
</template>
<style scoped>
.ambient-background {
  background: var(--gradient-space);
}
.ambient-beam {
  position: absolute;
  width: 850px;
  height: 950px;
  top: -590px;
  right: -60px;
  transform: rotate(-32deg);
  background: radial-gradient(
    ellipse,
    color-mix(in srgb, var(--ambient-color) 9%, transparent),
    transparent 68%
  );
  transition: background var(--motion-ambient);
}
.ambient-reflection {
  position: absolute;
  width: 60%;
  height: 190px;
  left: -20%;
  bottom: -90px;
  background: radial-gradient(
    ellipse,
    color-mix(in srgb, var(--ambient-color) 10%, transparent),
    transparent 65%
  );
}
.window-strip > div {
  display: flex;
  height: 100%;
}
.window-strip button {
  width: 37px;
  min-height: 24px;
  padding: 0;
}
.window-close:hover {
  background: var(--color-danger-soft);
}
.scene-controls {
  transition: opacity var(--motion-controls);
}
.scene-controls.controls-hidden {
  opacity: 0;
  pointer-events: none;
}
.scene-controls.controls-hidden:focus-within {
  opacity: 1;
  pointer-events: auto;
}
.scene-layout.active {
  color: var(--color-ink);
  border-bottom: 1px solid var(--color-ink);
}
.has-player .library-view {
  padding-bottom: 95px;
}
.notification.is-error {
  border-color: var(--color-danger-soft);
}
</style>
