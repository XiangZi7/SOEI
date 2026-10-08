<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { UiButton, UiIconButton, UiSlider, UiPanel } from '../../components/ui'
import Artwork from '../../components/ui/Artwork.vue'
import PlaybackSeekBar from './PlaybackSeekBar.vue'
const props = defineProps<{
  preview?: boolean
  compact?: boolean
  floating?: boolean
}>()
defineEmits<{ scene: []; queue: []; fullscreen: [] }>()
const store = useMusicStore()
const { activeTrack, previewTrack, snapshot } = storeToRefs(store)
const track = computed(() =>
  props.preview ? previewTrack.value : activeTrack.value
)
const modes = ['sequential', 'repeat', 'one', 'shuffle']
const modeLabel = computed(
  () =>
    ({
      sequential: '顺序播放',
      repeat: '列表循环',
      one: '单曲循环',
      shuffle: '随机播放',
    })[snapshot.value.repeatMode]
)
function repeat() {
  const index = modes.indexOf(snapshot.value.repeatMode)
  void store.command('repeat', { mode: modes[(index + 1) % modes.length] })
}
const seek = (positionMs: number) =>
  store.command('seek', { value: positionMs })
function volume(event: Event) {
  void store.command('volume', {
    value: Number((event.target as HTMLInputElement).value),
  })
}
function next(direction: number) {
  if (props.preview) {
    const index = store.demos.findIndex(item => item.id === store.previewId)
    store.previewId =
      store.demos[
        (index + direction + store.demos.length) % store.demos.length
      ]!.id
  } else void store.command(direction === 1 ? 'next' : 'previous')
}
</script>

<template>
  <UiPanel
    class="grid min-h-19 grid-cols-[minmax(170px,1fr)_minmax(120px,1fr)_auto_auto_auto] items-center gap-5.5 px-5 py-2.5 max-[700px]:grid-cols-[minmax(100px,1fr)_auto_auto] max-[700px]:gap-1 max-[700px]:px-3 max-lg:grid-cols-[minmax(160px,1fr)_minmax(90px,1fr)_auto_auto] max-lg:gap-2.5"
    :class="[
      { compact },
      floating
        ? 'min-h-22 rounded-full border-white/10 bg-stage/85 px-7 shadow-[0_15px_60px_#00000045] backdrop-blur-xl max-[700px]:rounded-2xl max-[700px]:px-4'
        : '',
    ]"
    role="region"
    aria-label="播放控制"
  >
    <UiButton
      variant="ghost"
      class="min-w-0 justify-start gap-3 px-0 text-left hover:bg-transparent"
      :disabled="!track"
      aria-label="打开当前歌曲场景"
      @click="$emit('scene')"
    >
      <span
        class="size-11 shrink-0 overflow-hidden rounded-input border border-line max-[700px]:size-9"
        ><Artwork
          :artwork="track?.artwork"
          :src="track?.coverRef"
          :title="track?.title"
      /></span>
      <span class="min-w-0"
        ><span
          class="block truncate-text font-display text-[15px] max-[700px]:text-sm"
          >{{ track?.title ?? '还没有开始聆听' }}</span
        ><span class="mt-1 block text-[9px] text-muted">{{
          preview
            ? '视觉预览 · 无音频'
            : (track?.artist ?? '导入音乐，打开你的空间')
        }}</span></span
      >
    </UiButton>
    <PlaybackSeekBar
      class="max-[700px]:col-span-3 max-[700px]:row-start-2"
      :snapshot="snapshot"
      :disabled="preview || !track || !snapshot.durationMs"
      :preview="preview"
      :seek="seek"
    />
    <div class="flex items-center gap-0.5">
      <UiIconButton
        class="mr-1.5 size-9 opacity-65 max-[700px]:hidden"
        :icon="
          snapshot.repeatMode === 'shuffle'
            ? 'shuffle'
            : snapshot.repeatMode === 'one'
              ? 'repeat-1'
              : 'repeat'
        "
        :icon-size="15"
        :disabled="preview || !track"
        :label="modeLabel ?? '播放模式'"
        @click="repeat"
      />
      <UiIconButton
        class="size-9 max-[700px]:size-7"
        icon="skip-back"
        :icon-size="17"
        :disabled="!track"
        :label="preview ? '上一个示例' : '上一首'"
        @click="next(-1)"
      />
      <UiIconButton
        class="mx-1 size-9 max-[700px]:size-7"
        :icon="snapshot.status === 'playing' && !preview ? 'pause' : 'play'"
        :icon-size="24"
        :disabled="preview || !track"
        :label="snapshot.status === 'playing' ? '暂停' : '播放'"
        @click="store.command('toggle')"
      />
      <UiIconButton
        class="size-9 max-[700px]:size-7"
        icon="skip-forward"
        :icon-size="17"
        :disabled="!track"
        :label="preview ? '下一个示例' : '下一首'"
        @click="next(1)"
      />
    </div>
    <div class="flex items-center max-lg:hidden">
      <UiIconButton
        :icon="snapshot.volume ? 'volume-2' : 'volume-x'"
        :icon-size="16"
        :disabled="preview"
        :label="snapshot.volume ? '静音' : '取消静音'"
        @click="store.command('volume', { value: snapshot.volume ? 0 : 0.65 })"
      /><UiSlider
        class="w-18"
        label="音量"
        :max="1"
        :step="0.01"
        :model-value="snapshot.volume"
        :disabled="preview"
        @input="volume"
      />
    </div>
    <div class="flex items-center gap-0.5">
      <UiIconButton
        class="max-[700px]:size-7"
        icon="list-music"
        :icon-size="17"
        label="播放队列"
        @click="$emit('queue')"
      /><UiIconButton
        class="max-[700px]:size-7"
        icon="maximize"
        :icon-size="16"
        label="切换全屏"
        @click="$emit('fullscreen')"
      />
    </div>
  </UiPanel>
</template>
