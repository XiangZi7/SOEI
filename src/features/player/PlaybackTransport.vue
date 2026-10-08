<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { AppIcon, UiButton, UiIconButton, UiSlider } from '../../components/ui'

const props = defineProps<{ preview?: boolean; expanded?: boolean }>()
const emit = defineEmits<{ queue: []; fullscreen: [] }>()
const options = useTemplateRef<HTMLDetailsElement>('options')
function closeOptions() {
  if (options.value) options.value.open = false
}
function queue() {
  closeOptions()
  emit('queue')
}
onClickOutside(options, closeOptions)
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
  <div
    class="playback-transport"
    :class="{ expanded }"
  >
    <UiIconButton
      v-if="expanded"
      class="transport-mode"
      :icon="
        snapshot.repeatMode === 'shuffle'
          ? 'shuffle'
          : snapshot.repeatMode === 'one'
            ? 'repeat-1'
            : 'repeat'
      "
      :icon-size="14"
      :label="modeLabel ?? '播放模式'"
      :disabled="preview || !track"
      @click="repeat"
    />
    <div class="transport-primary">
      <UiButton
        variant="icon"
        class="transport-button"
        :disabled="!track"
        :aria-label="preview ? '上一个示例' : '上一首'"
        :title="preview ? '上一个示例' : '上一首'"
        @click="next(-1)"
      >
        <svg
          class="skip-icon"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M4 4h2v12H4zm3 6 9-6v12z"
          />
        </svg>
      </UiButton>
      <UiButton
        variant="icon"
        class="transport-button transport-play"
        :disabled="preview || !track"
        :aria-label="
          snapshot.status === 'playing' && !preview ? '暂停' : '播放'
        "
        :title="snapshot.status === 'playing' && !preview ? '暂停' : '播放'"
        @click="store.command('toggle')"
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            v-if="snapshot.status === 'playing' && !preview"
            fill="currentColor"
            d="M5 2h3.5v16H5zm6.5 0H15v16h-3.5z"
          />
          <path
            v-else
            fill="currentColor"
            d="m6 2 12 8-12 8z"
          />
        </svg>
      </UiButton>
      <UiButton
        variant="icon"
        class="transport-button"
        :disabled="!track"
        :aria-label="preview ? '下一个示例' : '下一首'"
        :title="preview ? '下一个示例' : '下一首'"
        @click="next(1)"
      >
        <svg
          class="skip-icon"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M14 4h2v12h-2zM4 4l9 6-9 6z"
          />
        </svg>
      </UiButton>
    </div>
    <UiIconButton
      v-if="expanded"
      class="transport-queue"
      icon="list-music"
      :icon-size="14"
      label="播放队列"
      @click="queue"
    />
    <UiIconButton
      v-if="expanded"
      class="transport-fullscreen"
      icon="maximize"
      :icon-size="14"
      label="切换全屏"
      @click="$emit('fullscreen')"
    />
    <details
      v-else
      ref="options"
      class="transport-options"
      @keydown.esc.stop.prevent="closeOptions"
    >
      <summary
        aria-label="更多播放控制"
        title="更多播放控制"
      >
        <svg
          viewBox="0 0 20 20"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <g fill="currentColor">
            <circle
              cx="4"
              cy="10"
              r="1"
            />
            <circle
              cx="10"
              cy="10"
              r="1"
            />
            <circle
              cx="16"
              cy="10"
              r="1"
            />
          </g>
        </svg>
      </summary>
      <div class="transport-menu">
        <UiButton
          variant="ghost"
          :disabled="preview || !track"
          @click="repeat"
          ><AppIcon
            :name="
              snapshot.repeatMode === 'shuffle'
                ? 'shuffle'
                : snapshot.repeatMode === 'one'
                  ? 'repeat-1'
                  : 'repeat'
            "
            :size="15"
          />{{ modeLabel }}</UiButton
        >
        <UiButton
          variant="ghost"
          @click="queue"
          ><AppIcon
            name="list-music"
            :size="15"
          />播放队列</UiButton
        >
        <div class="transport-mobile-volume">
          <UiIconButton
            :icon="snapshot.volume ? 'volume-2' : 'volume-x'"
            :icon-size="14"
            :disabled="preview"
            :label="snapshot.volume ? '静音' : '取消静音'"
            @click="
              store.command('volume', { value: snapshot.volume ? 0 : 0.65 })
            "
          /><UiSlider
            label="音量"
            :max="1"
            :step="0.01"
            :model-value="snapshot.volume"
            :disabled="preview"
            @input="
              store.command('volume', {
                value: Number(($event.target as HTMLInputElement).value),
              })
            "
          />
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.playback-transport,
.transport-primary {
  display: flex;
  align-items: center;
  justify-content: center;
}
.transport-primary {
  gap: clamp(6px, 2vw, 26px);
}
.transport-button {
  width: 34px;
  height: 40px;
  border-radius: 3px;
}
.transport-button svg {
  width: 27px;
  height: 27px;
}
.transport-button .skip-icon {
  width: 16px;
  height: 16px;
}
.transport-play {
  margin: 0 2px;
}
.transport-button:disabled {
  opacity: 0.55;
}
.transport-options {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
}
.transport-options summary {
  display: grid;
  place-items: center;
  width: 26px;
  height: 36px;
  cursor: pointer;
  list-style: none;
  color: #a5aaa3;
}
.transport-options summary::-webkit-details-marker {
  display: none;
}
.transport-options summary:focus-visible {
  outline: 1px solid var(--color-focus);
}
.transport-menu {
  position: absolute;
  bottom: calc(100% + 12px);
  right: 0;
  display: grid;
  width: 160px;
  padding: 6px;
  border: 1px solid #b8c4bc35;
  border-radius: 6px;
  background: #0c1211f5;
  box-shadow: 0 8px 30px #0008;
}
.transport-menu button {
  justify-content: flex-start;
  padding: 0 10px;
  font-size: 12px;
}
.expanded {
  justify-content: space-between;
  gap: 4px;
}
.expanded .transport-primary {
  gap: clamp(4px, 3.4cqw, 30px);
}
.expanded > button {
  width: 30px;
  height: 40px;
  opacity: 0.75;
}
.transport-mobile-volume {
  display: none;
}
@media (max-width: 560px) {
  .transport-mobile-volume {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
  }
  .transport-mobile-volume input {
    width: 85px;
  }
  .transport-primary {
    gap: 1px;
  }
  .transport-button {
    width: 28px;
  }
  .expanded .transport-primary {
    gap: 1px;
  }
}
@media (max-width: 740px) {
  .transport-button svg {
    width: 21px;
    height: 21px;
  }
}
</style>
