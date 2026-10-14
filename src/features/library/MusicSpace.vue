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
import { useThemeStore } from '../../stores/theme'
import { call, desktop, onNative } from '../../bridge/native'
import { AppIcon, UiButton, UiIconButton } from '../../components/ui'
import AppShell from '../shell/AppShell.vue'
import AppSidebar from '../shell/AppSidebar.vue'
import AppTitleBar from '../shell/AppTitleBar.vue'
import SidePanel from '../shell/SidePanel.vue'
import MusicGallery from './MusicGallery.vue'
import SearchDialog from './SearchDialog.vue'
import PlayerControls from '../player/PlayerControls.vue'
import QueuePanel from '../player/QueuePanel.vue'
import ImmersiveScene from '../visual/ImmersiveScene.vue'
import SceneModePicker from '../visual/SceneModePicker.vue'
import SettingsDialog from '../settings/SettingsDialog.vue'
import WallpaperDialog from '../wallpaper/WallpaperDialog.vue'
import WallpaperPlayer from '../wallpaper/WallpaperPlayer.vue'
import { useWallpaperPlayerWindow } from '../wallpaper/useWallpaperPlayerWindow'
import { useCoverDrift } from '../visual/useCoverDrift'
import type { Track } from '../../types/music'
import Artwork from '../../components/ui/Artwork.vue'
const store = useMusicStore()
const theme = useThemeStore()
const { activeTrack, previewTrack, preferences, error, notice, scan } =
  storeToRefs(store)
const backgroundTrack = computed(() => activeTrack.value ?? previewTrack.value)
const wallpaperPlayer = computed(() => store.wallpaper.enabled.length > 0)
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
  // 进入壁纸前的全屏状态，用于恢复标题栏显示。
  fullscreenBeforeWallpaper: false,
  // 控制层可见性
  controlsVisible: true,
  // 控制层鼠标悬停状态
  controlsHovered: false,
  // 测试曲目正在加载
  testLoading: false,
  // 侧栏折叠状态
  sidebarCollapsed: false,
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
  controlsHovered,
  testLoading,
  sidebarCollapsed,
} = toRefs(state)
const {
  hidden: wallpaperPlayerHidden,
  edge: wallpaperPlayerEdge,
  reveal: revealWallpaperPlayer,
  drag: dragWallpaperPlayer,
} = useWallpaperPlayerWindow(wallpaperPlayer, store.report, {
  keepOpen: computed(
    () =>
      state.settingsOpen ||
      state.wallpaperOpen ||
      state.searchOpen ||
      state.queueOpen
  ),
  reducedMotion: computed(() => preferences.value.reducedMotion),
})
const musicInput = useTemplateRef<HTMLInputElement>('musicInput')
const lyricInput = useTemplateRef<HTMLInputElement>('lyricInput')
// 漂移挂在 Transition 外层的稳定节点上，换歌时动画不会重启。
const coverDrift = useTemplateRef<HTMLElement>('coverDrift')
useCoverDrift(coverDrift, () => ({
  strength: preferences.value.quality === 'power' ? 0 : 1,
  reducedMotion: preferences.value.reducedMotion,
}))
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
  if (!wallpaperPlayer.value && !state.sceneOpen)
    openCurrentScene(!store.activeTrack)
  state.wallpaperOpen = true
  revealControls()
}
// 悬停封面时整个界面按那张封面重新取色；结果按曲目缓存，重复悬停不再解码封面。
// 传入 null 表示离开画廊，回到当前播放/预览曲目的主题。
function preview(track: Track | null) {
  clearTimeout(ambientTimer)
  ambientTimer = setTimeout(() => {
    void theme.resolve(track ?? backgroundTrack.value)
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
// 换歌即换主题；取色写入 documentElement 的 CSS 变量，全局继承。
watch(backgroundTrack, track => void theme.resolve(track), { immediate: true })
watch(
  () => store.wallpaper.enabled.length,
  (enabled, previouslyEnabled) => {
    if (enabled > 0 && previouslyEnabled === 0) {
      state.scenePreview = false
      state.wallpaperOpen = false
      state.searchOpen = false
      state.queueOpen = false
      state.fullscreenBeforeWallpaper = state.fullscreen
      state.fullscreen = false
    }
    if (previouslyEnabled > 0 && enabled === 0) {
      state.fullscreen = state.fullscreenBeforeWallpaper
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
  <div
    class="music-space-root"
    :class="{ 'reduced-motion': preferences.reducedMotion }"
  >
    <!-- 壁纸小窗是独立的 560×310 窗口形态，不套应用外壳。 -->
    <WallpaperPlayer
      v-if="wallpaperPlayer"
      :hidden="wallpaperPlayerHidden"
      :edge="wallpaperPlayerEdge"
      @reveal="revealWallpaperPlayer"
      @drag="dragWallpaperPlayer"
      @queue="queueOpen = !queueOpen"
      @wallpaper="openWallpaper"
      @settings="settings('visual')"
      @restore="store.setWallpaper([])"
    />
    <AppShell v-else>
      <template #background>
        <div
          ref="coverDrift"
          class="library-cover-drift"
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
        </div>
        <span class="library-cover-shade" />
        <span class="ambient-beam" /><span class="ambient-reflection" />
      </template>

      <template #titlebar>
        <AppTitleBar
          v-if="!fullscreen"
          :theme-name="theme.theme.name"
          @search="toggleSearch"
          @settings="settings()"
          @error="store.report"
        />
      </template>

      <template #sidebar>
        <AppSidebar
          v-model:collapsed="sidebarCollapsed"
          @import="importMusic()"
          @scene="openCurrentScene(!activeTrack)"
        />
      </template>

      <div class="library-view">
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
            <p
              class="mt-2 text-[10px] leading-[1.6] tracking-[.08em] text-muted"
            >
              Every song.<br />becomes a visual world.
            </p>
          </div>
        </div>
        <footer
          class="space-colophon flex items-end justify-between font-display text-[9px] leading-[1.7] tracking-[.2em] text-muted"
        >
          <p>A NEW WAY TO FEEL MUSIC.<br />FOR A MORE BEAUTIFUL TOMORROW.</p>
          <p
            lang="ja"
            class="max-sm:hidden"
          >
            音楽で、少しだけ特別に。
          </p>
        </footer>
      </div>

      <template #panel>
        <SidePanel
          :open="queueOpen"
          @close="queueOpen = false"
        />
      </template>

      <template #stage>
        <Transition name="scene"
          ><div
            v-if="sceneOpen"
            class="scene-view"
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
              class="scene-controls absolute top-5 right-[4%] left-[4%] flex items-center justify-between gap-3"
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
                  :icon-size="17"
                  @click="settings('visual')"
                />
              </div>
            </div></div
        ></Transition>
      </template>

      <template #player>
        <PlayerControls
          variant="bar"
          :preview="sceneOpen ? scenePreview : !activeTrack"
          @queue="queueOpen = !queueOpen"
          @fullscreen="toggleFullscreen"
          @scene="
            sceneOpen ? settings('lyrics') : openCurrentScene(!activeTrack)
          "
        />
      </template>
    </AppShell>

    <!-- 两种窗口形态共用的弹层。壁纸小窗没有停靠栏，队列仍走悬浮面板。 -->
    <Transition name="fade"
      ><div
        v-if="queueOpen && wallpaperPlayer"
        class="compact-queue fixed right-[3%] bottom-25 z-(--z-popover)"
      >
        <QueuePanel @close="queueOpen = false" /></div
    ></Transition>
    <SearchDialog
      v-if="searchOpen"
      @close="searchOpen = false"
      @select="select"
    />
    <WallpaperDialog
      v-if="(sceneOpen || wallpaperPlayer) && wallpaperOpen"
      :compact="wallpaperPlayer"
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
      class="scan-toast glass-panel fixed bottom-28 left-6 z-(--z-notification) flex max-w-[min(500px,90vw)] items-center gap-3 rounded-input py-1.5 pr-2.5 pl-4 text-[11px]"
      role="status"
    >
      <AppIcon
        name="loader-circle"
        class="animate-spin"
      /><span>正在扫描 · 已导入 {{ scan.imported }} 首</span
      ><UiIconButton
        icon="x"
        label="取消扫描"
        :icon-size="14"
        @click="call('library_cancel').catch(store.report)"
      />
    </div>
    <Transition name="fade"
      ><div
        v-if="error || notice"
        class="notification glass-panel fixed top-14 left-1/2 z-(--z-notification) flex max-w-[min(500px,90vw)] -translate-x-1/2 items-center gap-3 rounded-input py-1.5 pr-2.5 pl-4 text-[11px]"
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
          :icon-size="14"
          @click="dismissNotification"
        /></div
    ></Transition>
    <input
      ref="musicInput"
      class="sr-only"
      tabindex="-1"
      type="file"
      accept="audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac,.lrc,.vtt,.ttml,.yrc,.qrc,.krc,.awlrc"
      multiple
      @change="filesSelected"
    />
    <input
      ref="lyricInput"
      class="sr-only"
      tabindex="-1"
      type="file"
      accept=".lrc,.vtt,.ttml,.yrc,.qrc,.krc,.awlrc"
      @change="lyricsSelected"
    />
  </div>
</template>
<style scoped>
/* 根容器不参与布局：AppShell 是 fixed inset-0，弹层各自 fixed，
   这里只承载 reduced-motion / is-fullscreen 这类全局修饰 class。 */
.music-space-root {
  display: contents;
}
.compact-queue {
  top: 42px;
  bottom: 12px;
  overflow-y: auto;
  border-radius: var(--radius-panel);
}
/* 内容区自己滚动，所以留白写在内容上而不是窗口上。 */
.library-view {
  max-width: 1280px;
  margin: 0 auto;
  padding: 26px 0 32px;
}
.library-note {
  margin: 4px 28px 20px;
}
.library-motto {
  width: 142px;
  color: #cecec4;
}
.space-colophon {
  padding: 20px 28px 0;
  opacity: 0.65;
}
.library-cover-drift {
  position: absolute;
  inset: 0;
  will-change: transform;
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
  transition: background var(--motion-ambient);
}
/* 歌词舞台铺满外壳的 body 区：覆盖侧栏与内容区，标题栏与播放条留在外面。 */
.scene-view {
  position: absolute;
  inset: 0;
  z-index: var(--z-scene);
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
  .library-motto {
    width: 100px;
  }
}
@media (max-width: 600px) {
  .library-view {
    padding: 16px 0 24px;
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
