<script setup lang="ts">
import {
  computed,
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
import {
  AppIcon,
  UiButton,
  UiIconButton,
  WindowTitleBar,
} from '../../components/ui'
import SpaceHeader from './SpaceHeader.vue'
import MusicGallery from './MusicGallery.vue'
import SearchDialog from './SearchDialog.vue'
import PlayerControls from '../player/PlayerControls.vue'
import QueuePanel from '../player/QueuePanel.vue'
import ImmersiveScene from '../visual/ImmersiveScene.vue'
import SceneModePicker from '../visual/SceneModePicker.vue'
import SettingsDialog from '../settings/SettingsDialog.vue'
import WallpaperDialog from '../wallpaper/WallpaperDialog.vue'
import type { Track } from '../../types/music'
import Artwork from '../../components/ui/Artwork.vue'
const store = useMusicStore()
const { activeTrack, previewTrack, preferences, error, notice, scan } =
  storeToRefs(store)
const backgroundTrack = computed(() => activeTrack.value ?? previewTrack.value)
// 响应式状态
const state = reactive({
  // 沉浸场景开关
  sceneOpen: false,
  // 当前场景是无音频的示例
  scenePreview: false,
  // 设置弹层开关
  settingsOpen: false,
  // 沉浸播放页的壁纸面板
  wallpaperOpen: false,
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
  // 测试曲目正在加载
  testLoading: false,
  // 聚焦封面的环境颜色
  ambientColor: 'var(--color-ambient-default)',
})
const {
  sceneOpen,
  scenePreview,
  settingsOpen,
  wallpaperOpen,
  settingsCategory,
  searchOpen,
  queueOpen,
  fullscreen,
  controlsVisible,
  ambientColor,
  controlsHovered,
  testLoading,
} = toRefs(state)
const musicInput = useTemplateRef<HTMLInputElement>('musicInput')
const lyricInput = useTemplateRef<HTMLInputElement>('lyricInput')
let hideTimer: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let ambientTimer: ReturnType<typeof setTimeout> | undefined
let trayCleanup: (() => void) | undefined

function importMusic(directory = false) {
  if (desktop) void store.importMusic(directory)
  else musicInput.value?.click()
}
async function filesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  try {
    await store.importBrowserFiles(input.files)
  } catch (error) {
    store.report(error)
  } finally {
    input.value = ''
  }
}
async function lyricsSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const id = store.activeTrack?.id
  try {
    if (file && id) await store.importBrowserLyrics(file, id)
  } catch (error) {
    store.report(error)
  } finally {
    input.value = ''
  }
}
function importLyrics() {
  if (desktop) void store.importLyrics()
  else lyricInput.value?.click()
}
async function playTest() {
  if (state.testLoading) return
  state.testLoading = true
  try {
    const track = await store.preparePlaybackTest()
    if (!track) return
    await select(track)
    if (store.snapshot.trackId === track.id && !store.error) {
      store.notice = '36 秒自制旋律与同步测试歌词 · 可暂停或拖动进度'
    }
  } finally {
    state.testLoading = false
  }
}
async function select(track: Track) {
  await store.select(track)
  if (track.demo || store.snapshot.trackId === track.id) {
    state.scenePreview = !!track.demo
    state.sceneOpen = true
    revealControls()
  }
}
function openCurrentScene(preview = false) {
  state.scenePreview = preview
  state.sceneOpen = true
  revealControls()
}
function openWallpaper() {
  if (!state.sceneOpen) openCurrentScene(!store.activeTrack)
  state.wallpaperOpen = true
  revealControls()
}
function preview(track: Track | null) {
  clearTimeout(ambientTimer)
  ambientTimer = setTimeout(() => {
    state.ambientColor = track?.color ?? 'var(--color-ambient-default)'
  }, 80)
}
function toggleSearch() {
  state.searchOpen = !state.searchOpen
}
function settings(category = 'general') {
  if (desktop) {
    void store.flushPreferences().then(saved => {
      if (saved) void call('settings_open', { category }).catch(store.report)
    })
    return
  }
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
      !state.wallpaperOpen &&
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
    !!target.closest(
      'input,textarea,select,button,summary,[contenteditable=true]'
    )
  if (event.key === 'Escape') {
    if (state.settingsOpen || state.searchOpen || state.wallpaperOpen) return
    if (state.queueOpen) state.queueOpen = false
    else if (state.fullscreen) void toggleFullscreen()
    else if (state.sceneOpen) state.sceneOpen = false
    event.preventDefault()
  } else if (
    event.code === 'Space' &&
    !interactive &&
    !state.settingsOpen &&
    !state.wallpaperOpen &&
    !state.searchOpen &&
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
watch(
  () => store.wallpaper.enabled.length,
  (enabled, previouslyEnabled) => {
    if (previouslyEnabled > 0 && enabled === 0) {
      state.sceneOpen = false
      state.wallpaperOpen = false
      state.queueOpen = false
    }
  }
)
onMounted(async () => {
  window.addEventListener('keydown', keyboard)
  document.addEventListener('fullscreenchange', fullscreenChange)
  await store.initialize()
  if (desktop) trayCleanup = await onNative('ui:wallpaper', openWallpaper)
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
      'has-window-strip': desktop && !fullscreen,
    }"
    :style="{ '--ambient-color': ambientColor }"
  >
    <div
      class="ambient-background pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      <Transition
        name="ambient-cover"
        appear
        ><div
          v-if="backgroundTrack"
          :key="backgroundTrack.id"
          class="library-cover-layer"
        >
          <Artwork
            class="library-cover-background"
            eager
            :artwork="backgroundTrack.artwork"
            :src="backgroundTrack.coverRef"
            :title="backgroundTrack.title"
          /></div
      ></Transition>
      <span class="library-cover-shade" />
      <span class="ambient-beam" /><span class="ambient-reflection" />
    </div>
    <WindowTitleBar
      v-if="desktop && !fullscreen && sceneOpen"
      class="fixed top-0 right-0 left-0 z-(--z-window)"
      @close="call('window_action', { action: 'close' }).catch(store.report)"
      @error="store.report"
    />
    <div
      v-show="!sceneOpen"
      class="library-view relative isolate z-0"
    >
      <SpaceHeader
        @search="toggleSearch"
        @settings="settings()"
        @import="importMusic()"
        ><template
          v-if="desktop && !fullscreen"
          #window
          ><WindowTitleBar
            embedded
            @close="
              call('window_action', { action: 'close' }).catch(store.report)
            "
            @error="store.report" /></template
      ></SpaceHeader>
      <MusicGallery
        :test-loading="testLoading"
        @select="select"
        @preview="preview"
        @import="importMusic"
        @test="playTest"
        @scene="openCurrentScene"
      />
      <div class="library-note">
        <div class="library-motto shrink-0 font-display">
          <p
            class="text-[13px] leading-[1.8] tracking-[.15em]"
            lang="ja"
          >
            音が、<br />世界をつくる。
          </p>
          <p class="mt-2 text-[10px] leading-[1.6] tracking-[.08em] text-muted">
            Every song.<br />becomes a visual world.
          </p>
        </div>
      </div>
    </div>
    <footer
      v-show="!sceneOpen"
      class="space-colophon mx-auto flex items-end justify-between font-display text-[9px] leading-[1.7] tracking-[.2em] text-muted"
    >
      <p>A NEW WAY TO FEEL MUSIC.<br />FOR A MORE BEAUTIFUL TOMORROW.</p>
      <p
        lang="ja"
        class="max-sm:hidden"
      >
        音楽で、少しだけ特別に。
      </p>
    </footer>
    <Transition name="scene"
      ><div
        v-if="sceneOpen"
        class="scene-view fixed inset-0 z-(--z-scene)"
        @pointermove="revealControls"
        @touchstart="revealControls"
      >
        <ImmersiveScene
          :preview="scenePreview"
          @queue="queueOpen = !queueOpen"
          @fullscreen="toggleFullscreen"
          @close="sceneOpen = false"
        />
        <div
          class="scene-controls absolute top-9 right-[5%] left-[5%] flex items-center justify-between gap-3 max-sm:top-5 max-sm:right-[4%] max-sm:left-[4%]"
          :class="{ 'controls-hidden': !controlsVisible }"
          @pointerenter="controlsHovered = true"
          @pointerleave="leaveControls"
          @focusin="revealControls"
        >
          <UiButton
            variant="ghost"
            class="min-h-11 gap-2 rounded-full border border-line bg-stage/60 px-4 text-label backdrop-blur-xl max-sm:px-3"
            @click="sceneOpen = false"
            ><AppIcon
              name="arrow-left"
              :size="15"
            /><span class="max-sm:hidden">音乐空间</span
            ><span class="hidden max-sm:inline">返回</span></UiButton
          >
          <SceneModePicker
            v-model="preferences.layout"
            v-model:seed="preferences.sceneSeed"
            compact
          />
          <div class="flex items-center gap-2">
            <UiIconButton
              icon="monitor"
              label="桌面壁纸"
              class="size-11 rounded-full border border-line bg-stage/60 backdrop-blur-xl"
              :active="!!store.wallpaper.enabled.length"
              :icon-size="17"
              @click="openWallpaper"
            />
            <UiIconButton
              icon="settings-2"
              label="场景设置"
              class="size-11 rounded-full border border-line bg-stage/60 backdrop-blur-xl"
              @click="settings('visual')"
              :icon-size="17"
            />
          </div>
        </div></div
    ></Transition>
    <div
      class="player-dock scene-controls fixed right-[5%] bottom-9 left-[5%] z-(--z-controls) mx-auto max-w-260 max-sm:right-[4%] max-sm:bottom-5 max-sm:left-[4%]"
      @pointerenter="controlsHovered = true"
      @pointerleave="leaveControls"
      @focusin="revealControls"
    >
      <PlayerControls
        :preview="sceneOpen ? scenePreview : !activeTrack"
        @queue="queueOpen = !queueOpen"
        @fullscreen="toggleFullscreen"
        @scene="sceneOpen ? settings('lyrics') : openCurrentScene(!activeTrack)"
      />
    </div>
    <Transition name="fade"
      ><div
        v-if="queueOpen"
        class="fixed right-[5%] bottom-36 z-(--z-popover) max-sm:right-[3%] max-sm:bottom-25"
      >
        <QueuePanel @close="queueOpen = false" /></div
    ></Transition>
    <SearchDialog
      v-if="searchOpen"
      @close="searchOpen = false"
      @select="select"
    />
    <WallpaperDialog
      v-if="sceneOpen && wallpaperOpen"
      @close="wallpaperOpen = false"
    />
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
      accept="audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac,.lrc"
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
.music-space {
  --navigation-height: 112px;
  padding: calc(var(--navigation-height) + 24px) 3vw 166px;
}
.library-view {
  max-width: 1280px;
  margin: 0 auto;
}
.library-note {
  margin: 4px 28px 20px;
}
.library-motto {
  width: 142px;
  color: #cecec4;
}
.space-colophon {
  max-width: 1280px;
  padding: 20px 28px 0;
  opacity: 0.65;
}
.library-cover-layer {
  position: absolute;
  inset: 0;
}
.library-cover-background {
  position: absolute;
  inset: -32px;
  width: calc(100% + 64px);
  height: calc(100% + 64px);
  opacity: 0.26;
  filter: blur(22px) saturate(0.65);
}
.library-cover-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, #04090880, #04090825 50%, #040908b0),
    linear-gradient(90deg, #04090850, transparent 60%, #04090840);
}
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
.has-window-strip .scene-view {
  top: var(--spacing-window-strip);
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
.notification.is-error {
  border-color: var(--color-danger-soft);
}
@media (max-width: 1000px) {
  .music-space {
    --navigation-height: 160px;
  }
  .library-motto {
    width: 100px;
  }
}
@media (max-width: 600px) {
  .music-space {
    padding: calc(var(--navigation-height) + 18px) 12px 110px;
  }
  .library-note {
    margin: 8px 18px 18px;
  }
  .library-motto {
    display: none;
  }
  .space-colophon {
    padding-top: 15px;
    font-size: 8px;
  }
}
</style>
