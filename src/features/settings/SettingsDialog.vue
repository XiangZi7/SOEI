<script setup lang="ts">
import { computed, onMounted, reactive, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { call, desktop } from '../../bridge/native'
import {
  AppIcon,
  UiButton,
  UiIconButton,
  UiInput,
  UiSelect,
  UiSwitch,
  UiSlider,
  UiDialog,
} from '../../components/ui'
import SettingRow from './SettingRow.vue'
import { sceneModes } from '../visual/sceneModes'
const props = defineProps<{ initialCategory?: string }>()
const emit = defineEmits<{ close: []; lyrics: [] }>()
const store = useMusicStore()
const { preferences, snapshot, activeTrack, displays, wallpaper, error } =
  storeToRefs(store)
// 响应式状态
const state = reactive({
  // 当前设置分类
  category: props.initialCategory ?? 'general',
  // 选中的壁纸显示器
  selectedDisplays: [...store.wallpaper.enabled],
  // 快捷键草稿
  shortcuts: {
    toggle: 'Control+Alt+P',
    previous: 'Control+Alt+Left',
    next: 'Control+Alt+Right',
  },
  // 系统操作进行中
  busy: false,
  // 注册结果
  shortcutResult: '',
})
const { category, selectedDisplays, shortcuts, busy, shortcutResult } =
  toRefs(state)
const categories = [
  { id: 'general', en: 'General', title: '常规' },
  { id: 'playback', en: 'Playback', title: '播放' },
  { id: 'lyrics', en: 'Lyrics', title: '歌词' },
  { id: 'visual', en: 'Visual', title: '视觉' },
  { id: 'display', en: 'Display', title: '显示与壁纸' },
  { id: 'performance', en: 'Performance', title: '性能' },
  { id: 'shortcuts', en: 'Shortcuts', title: '快捷键' },
  { id: 'about', en: 'About', title: '关于' },
]
const selectedCategory = computed(() =>
  categories.find(category => category.id === state.category)!
)
onMounted(() => {
  void store.refreshDisplays()
})
async function applyWallpaper() {
  if (state.busy) return
  state.busy = true
  try {
    await store.setWallpaper([...state.selectedDisplays])
  } finally {
    state.busy = false
  }
}
function disableWallpaper() {
  if (state.busy) return
  state.selectedDisplays = []
  void applyWallpaper()
}
async function applyShortcuts(clear = false) {
  state.busy = true
  try {
    await call('shortcuts_set', { bindings: clear ? {} : state.shortcuts })
    state.shortcutResult = clear ? '快捷键已停用' : '快捷键已注册'
  } catch (error) {
    store.report(error)
    state.shortcutResult = '注册失败，请更换组合键'
  }
  state.busy = false
}
</script>
<template>
  <UiDialog
    title="Settings"
    @close="emit('close')"
  >
    <div class="flex-between border-b border-line px-8 py-6 max-sm:px-5">
      <div>
        <p class="eyebrow">MAKE THIS SPACE YOURS</p>
        <h1
          id="settings-title"
          class="mt-2.5 font-display text-4xl"
        >
          Settings
        </h1>
      </div>
      <UiIconButton
        icon="x"
        label="关闭设置"
        @click="emit('close')"
      />
    </div>
    <div
      class="grid max-h-[calc(100dvh-245px)] min-h-100 grid-cols-[163px_1fr] max-sm:flex max-sm:flex-col"
    >
      <nav
        class="settings-nav overflow-auto border-r border-line py-5 max-sm:flex max-sm:shrink-0 max-sm:border-r-0 max-sm:border-b max-sm:px-3 max-sm:py-1"
        aria-label="设置分类"
      >
        <UiButton
          variant="ghost"
          v-for="item in categories"
          :key="item.id"
          class="flex w-full justify-between gap-3 rounded-none border-l-2 py-3 pr-5 pl-5 text-left font-display text-label max-sm:w-auto max-sm:whitespace-nowrap"
          :class="
            category === item.id
              ? 'border-accent bg-hover text-ink'
              : 'border-transparent text-muted'
          "
          @click="category = item.id"
          ><span>{{ item.en }}</span
          ><small class="font-ui text-[9px] max-sm:hidden">{{
            item.title
          }}</small></UiButton
        >
      </nav>
      <section class="overflow-y-auto px-8 py-6 max-sm:px-5">
        <h2 class="mb-3 font-display text-xl">{{ selectedCategory.title }}</h2>
        <template v-if="category === 'general'">
          <SettingRow
            title="常显歌曲信息"
            hint="浏览封面时，也显示歌曲名和歌手。"
            ><UiSwitch
              v-model="preferences.showTitles"
              label="常显歌曲信息"
          /></SettingRow>
          <SettingRow
            title="关闭时隐藏到托盘"
            hint="开启后，关闭主窗口会保留音乐。可从托盘菜单退出。"
            ><UiSwitch
              v-model="preferences.closeToTray"
              label="关闭时隐藏到托盘"
              :disabled="!desktop"
          /></SettingRow>
          <SettingRow
            title="无边框窗口"
            hint="也可以切换到系统标题栏。"
            ><UiButton
              variant="ghost"
              class="border border-line"
              :disabled="!desktop"
              @click="
                call('window_action', { action: 'borderless' }).catch(
                  store.report
                )
              "
              >切换标题栏</UiButton
            ></SettingRow
          >
        </template>
        <template v-else-if="category === 'playback'">
          <SettingRow title="播放模式"
            ><UiSelect
              class="text-[11px]"
              label="播放模式"
              :model-value="snapshot.repeatMode"
              @change="
                store.command('repeat', {
                  mode: ($event.target as HTMLSelectElement).value,
                })
              "
              ><option value="sequential">顺序播放</option>
              <option value="repeat">列表循环</option>
              <option value="one">单曲循环</option>
              <option value="shuffle">随机播放</option></UiSelect
            ></SettingRow
          >
          <SettingRow title="音量"
            ><UiSlider
              :min="0"
              :max="1"
              :step="0.01"
              :model-value="snapshot.volume"
              label="设置音量"
              @input="
                store.command('volume', {
                  value: Number(($event.target as HTMLInputElement).value),
                })
              "
            /><span>{{ Math.round(snapshot.volume * 100) }}%</span></SettingRow
          >
          <p class="my-5 text-[11px] leading-loose text-muted">
            返回音乐空间或切换场景时，当前歌曲会继续播放。
          </p>
        </template>
        <template v-else-if="category === 'lyrics'">
          <SettingRow title="歌词排版"
            ><UiSelect
              v-model="preferences.layout"
              class="text-[11px]"
              label="歌词排版"
              ><option
                v-for="mode in sceneModes"
                :key="mode.id"
                :value="mode.id"
              >
                {{ mode.name }} · {{ mode.description }}
              </option></UiSelect
            ></SettingRow
          >
          <SettingRow title="歌词字号"
            ><UiSlider
              v-model.number="preferences.lyricSize"
              :min="24"
              :max="68"
              :step="2"
              label="歌词字号"
            /><span>{{ preferences.lyricSize }}</span></SettingRow
          >
          <SettingRow
            title="歌词同步偏移"
            hint="正值提前显示，负值延后显示。单位为毫秒。"
            ><UiInput
              v-model.number="preferences.lyricOffset"
              class="w-22"
              type="number"
              min="-30000"
              max="30000"
              step="100"
              label="歌词同步偏移"
          /></SettingRow>
          <SettingRow
            title="当前歌曲歌词"
            :hint="activeTrack?.title ?? '先选择一首本地音乐。'"
            ><UiButton
              variant="ghost"
              class="border border-line"
              :disabled="!activeTrack"
              @click="emit('lyrics')"
              ><AppIcon
                name="file-text"
                :size="14"
              />导入 LRC</UiButton
            ></SettingRow
          >
        </template>
        <template v-else-if="category === 'visual'">
          <SettingRow
            title="场景背景"
            hint="使用歌曲封面，或选择你喜欢的图片和静音视频。"
            ><UiButton
              variant="ghost"
              class="border border-line"
              :disabled="!desktop"
              @click="store.chooseBackground()"
              ><AppIcon
                name="image"
                :size="14"
              />选择背景</UiButton
            ></SettingRow
          >
          <SettingRow
            v-if="preferences.background"
            title="已选背景"
            :hint="preferences.background.split(/[\\/]/).pop()"
            ><UiButton
              variant="ghost"
              class="border border-line"
              @click="preferences.background = ''"
              >恢复歌曲封面</UiButton
            ></SettingRow
          >
          <SettingRow
            title="减少动态效果"
            hint="关闭背景光场运动与歌词入场动画，也会遵循系统的减少动态效果设置。"
            ><UiSwitch
              v-model="preferences.reducedMotion"
              label="减少动态效果"
          /></SettingRow>
        </template>
        <template v-else-if="category === 'display'">
          <p class="my-5 text-[11px] leading-loose text-muted">
            画面会显示在桌面图标后方，所有显示器共用当前音乐。只有点击启用后才会更改桌面。
          </p>
          <label
            v-for="display in displays"
            :key="display.id"
            class="flex items-center gap-4 border-b border-line py-4 text-label"
            ><AppIcon
              name="monitor"
              :size="28" /><span class="flex-1"
              >{{ display.name
              }}<small class="mt-2 block text-caption text-muted"
                >{{ display.width }} × {{ display.height }} ·
                {{ Math.round(display.scale * 100) }}%</small
              ></span
            ><input
              type="checkbox"
              v-model="selectedDisplays"
              :value="display.id"
              :aria-label="`在 ${display.name} 启用壁纸`"
          /></label>
          <p
            v-if="!desktop"
            class="my-5 text-[11px] leading-loose text-muted"
          >
            请在 SOEI 桌面窗口中使用壁纸功能。
          </p>
          <p
            v-if="wallpaper.error"
            class="text-[11px] text-danger"
          >
            {{ wallpaper.error }}
          </p>
          <div class="mt-5 flex items-center gap-2.5">
            <UiButton
              variant="ghost"
              class="bg-accent text-surface"
              :disabled="!desktop || busy"
              @click="applyWallpaper"
              >{{ busy ? '正在应用…' : '应用壁纸' }}</UiButton
            ><UiButton
              variant="ghost"
              class="border border-line"
              :disabled="!wallpaper.enabled.length || busy"
              @click="disableWallpaper"
              >停用壁纸</UiButton
            ><UiIconButton
              icon="repeat"
              :disabled="!desktop"
              label="刷新显示器"
              @click="store.refreshDisplays()"
              :icon-size="15"
            />
          </div>
        </template>
        <template v-else-if="category === 'performance'">
          <SettingRow
            title="视觉质量"
            hint="高质量最高 60 帧，平衡模式最高 30 帧；省电模式使用静态光场。"
            ><UiSelect
              v-model="preferences.quality"
              class="text-[11px]"
              label="视觉质量"
              ><option value="high">高质量</option>
              <option value="balanced">平衡</option>
              <option value="power">省电</option></UiSelect
            ></SettingRow
          >
          <SettingRow title="减少动态效果"
            ><UiSwitch
              v-model="preferences.reducedMotion"
              label="性能设置：减少动态效果"
          /></SettingRow>
          <p class="my-5 text-[11px] leading-loose text-muted">
            歌曲暂停后，歌词和播放进度保持稳定。音频服务持续在后台运行，不依赖主窗口是否可见。
          </p>
        </template>
        <template v-else-if="category === 'shortcuts'">
          <p class="my-5 text-[11px] leading-loose text-muted">
            窗口内可用空格暂停、Esc 返回。全局组合键需点击注册，冲突时会提示。
          </p>
          <SettingRow title="播放 / 暂停"
            ><UiInput
              v-model="shortcuts.toggle"
              class="w-42 text-[11px]"
              label="播放暂停快捷键"
          /></SettingRow>
          <SettingRow title="上一首"
            ><UiInput
              v-model="shortcuts.previous"
              class="w-42 text-[11px]"
              label="上一首快捷键"
          /></SettingRow>
          <SettingRow title="下一首"
            ><UiInput
              v-model="shortcuts.next"
              class="w-42 text-[11px]"
              label="下一首快捷键"
          /></SettingRow>
          <div class="mt-5 flex items-center gap-2.5">
            <UiButton
              variant="ghost"
              class="border border-line"
              :disabled="!desktop || busy"
              @click="applyShortcuts()"
              >注册组合键</UiButton
            ><UiButton
              variant="ghost"
              class="border border-line"
              :disabled="!desktop || busy"
              @click="applyShortcuts(true)"
              >停用</UiButton
            >
          </div>
          <p
            class="my-5 text-[11px] leading-loose text-muted"
            role="status"
          >
            {{ shortcutResult }}
          </p>
        </template>
        <template v-else>
          <div class="pt-5 font-display text-6xl tracking-[.13em]">
            SOEI<span
              class="mt-2 block font-display text-base tracking-normal italic"
              >Music becomes a world.</span
            >
          </div>
          <p class="my-5 text-[11px] leading-loose text-muted">
            本地音乐 · 艺术歌词 · 沉浸式音乐空间<br />开发版本 0.1.0
          </p>
          <p class="my-5 text-[11px] leading-loose text-muted">
            示例图像取自你提供的 UI
            稿，仅用于视觉开发参考。示例不附带音频。导入文件会建立索引，原始音乐保留在原位置。
          </p>
        </template>
      </section>
    </div>
    <div
      v-if="error"
      class="settings-error flex-between p-4"
      role="alert"
    >
      {{ error
      }}<UiIconButton
        icon="x"
        label="关闭错误提示"
        @click="store.error = ''"
        :icon-size="14"
      />
    </div>
    <footer
      class="flex-between border-t border-line px-7 py-4 text-[9px] tracking-wide text-muted"
    >
      <span>SOEI / YOUR PERSONAL MUSIC SPACE</span><span>设置自动保存</span>
    </footer>
  </UiDialog>
</template>
