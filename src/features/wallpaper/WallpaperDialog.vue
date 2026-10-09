<script setup lang="ts">
import { onMounted, reactive, toRefs, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { desktop } from '../../bridge/native'
import { useMusicStore } from '../../stores/music'
import { AppIcon, UiButton, UiDialog, UiIconButton } from '../../components/ui'

defineEmits<{ close: [] }>()
defineProps<{ compact?: boolean }>()
const store = useMusicStore()
const { activeTrack, displays, wallpaper, error } = storeToRefs(store)
const state = reactive({
  selectedDisplays: [...store.wallpaper.enabled],
  busy: false,
})
const { selectedDisplays, busy } = toRefs(state)
watch(
  () => store.wallpaper.enabled,
  enabled => {
    state.selectedDisplays = [...enabled]
  }
)
onMounted(() => {
  void store.refreshDisplays()
})
async function applyWallpaper(enabled: string[]) {
  if (state.busy) return
  state.busy = true
  try {
    await store.setWallpaper(enabled)
  } finally {
    state.busy = false
  }
}
</script>

<template>
  <UiDialog
    title="桌面壁纸"
    class="w-[min(600px,calc(100vw-2rem))]"
    @close="$emit('close')"
  >
    <section
      class="flex max-h-[calc(100dvh-3rem)] flex-col"
      aria-labelledby="wallpaper-title"
    >
      <header
        class="flex-between min-h-28 shrink-0 border-b border-line px-7 py-7 max-sm:px-5"
        :class="{ 'compact-header': compact }"
      >
        <div>
          <p
            v-if="!compact"
            class="eyebrow"
          >
            DISPLAY &amp; WALLPAPER
          </p>
          <h2
            id="wallpaper-title"
            class="mt-2 font-display text-2xl"
          >
            桌面壁纸
          </h2>
        </div>
        <UiIconButton
          icon="x"
          label="关闭壁纸设置"
          @click="$emit('close')"
        />
      </header>
      <div
        class="min-h-0 overflow-y-auto px-7 py-5 max-sm:px-5"
        :class="{ 'compact-content': compact }"
      >
        <p
          v-if="!compact"
          class="mb-5 text-label leading-loose text-muted"
        >
          将当前歌曲的沉浸场景显示在桌面图标后方，所有显示器同步音乐与歌词。
        </p>
        <p
          v-if="activeTrack"
          class="mb-4 truncate-text text-label"
        >
          当前歌曲 · {{ activeTrack.title }}
        </p>
        <p
          v-else
          class="mb-4 text-label text-muted"
        >
          先播放一首本地音乐，再将场景应用为壁纸。
        </p>
        <label
          v-for="display in displays"
          :key="display.id"
          class="flex items-center gap-4 border-b border-line py-4 text-label"
        >
          <AppIcon
            name="monitor"
            :size="28"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate-text">{{ display.name }}</span>
            <small class="mt-2 block text-caption text-muted"
              >{{ display.width }} × {{ display.height }} ·
              {{ Math.round(display.scale * 100) }}%</small
            >
          </span>
          <input
            type="checkbox"
            v-model="selectedDisplays"
            :value="display.id"
            :disabled="busy"
            :aria-label="'在 ' + display.name + ' 启用壁纸'"
          />
        </label>
        <p
          v-if="!desktop"
          class="mt-5 text-label leading-loose text-muted"
        >
          请在 SOEI 桌面窗口中使用壁纸功能。
        </p>
        <p
          v-else-if="!displays.length"
          class="mt-5 text-label text-muted"
        >
          未找到显示器，请刷新后重试。
        </p>
        <p
          v-if="wallpaper.error || error"
          class="mt-5 text-label text-danger"
          role="alert"
        >
          {{ wallpaper.error || error }}
        </p>
      </div>
      <footer
        class="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-line px-7 py-5 max-sm:px-5"
        :class="{ 'compact-footer': compact }"
      >
        <UiButton
          variant="solid"
          :disabled="
            !desktop || !activeTrack || !selectedDisplays.length || busy
          "
          @click="applyWallpaper([...selectedDisplays])"
          >{{ busy ? '正在应用…' : '应用壁纸' }}</UiButton
        >
        <UiButton
          :disabled="!wallpaper.enabled.length || busy"
          @click="applyWallpaper([])"
          >停用壁纸</UiButton
        >
        <UiIconButton
          icon="repeat"
          :disabled="!desktop || busy"
          label="刷新显示器"
          @click="store.refreshDisplays()"
          :icon-size="15"
        />
      </footer>
    </section>
  </UiDialog>
</template>

<style scoped>
.compact-header {
  min-height: 58px;
  padding-block: 8px;
}
.compact-header h2 {
  margin-top: 0;
  font-size: 20px;
}
.compact-content {
  padding-block: 10px;
}
.compact-content > p {
  margin-bottom: 4px;
}
.compact-content > label {
  padding-block: 8px;
}
.compact-footer {
  padding-block: 10px;
}
</style>
