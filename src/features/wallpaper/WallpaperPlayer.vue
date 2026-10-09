<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { call, desktop } from '../../bridge/native'
import { UiIconButton } from '../../components/ui'
import CoverComposition from '../visual/CoverComposition.vue'
import PlaybackSeekBar from '../player/PlaybackSeekBar.vue'
import PlaybackTransport from '../player/PlaybackTransport.vue'
import { lyricIndexAt } from '../lyrics/lrc'

defineProps<{ hidden?: boolean }>()
const emit = defineEmits<{
  queue: []
  wallpaper: []
  settings: []
  restore: []
  reveal: []
}>()
const player = useTemplateRef<HTMLElement>('player')
const store = useMusicStore()
const { activeTrack, lyrics, snapshot, preferences } = storeToRefs(store)
const lyricIndex = computed(() =>
  lyricIndexAt(
    lyrics.value,
    snapshot.value.positionMs +
      preferences.value.lyricOffset +
      (activeTrack.value
        ? (preferences.value.trackOffsets[activeTrack.value.id] ?? 0)
        : 0)
  )
)
const seek = (positionMs: number) =>
  store.command('seek', { value: positionMs })
function windowAction(action: string) {
  if (desktop) void call('window_action', { action }).catch(store.report)
}
function revealFromKeyboard() {
  emit('reveal')
  void nextTick(() => {
    player.value
      ?.querySelector<HTMLButtonElement>('.compact-actions button')
      ?.focus()
  })
}
</script>

<template>
  <section
    ref="player"
    class="wallpaper-player"
    :class="{ 'is-retracted': hidden }"
    aria-label="壁纸模式播放器"
  >
    <button
      v-if="hidden"
      class="wallpaper-edge"
      type="button"
      aria-label="展开壁纸播放器"
      aria-expanded="false"
      title="展开播放器"
      @click="$emit('reveal')"
      @focus="revealFromKeyboard"
    >
      <span
        class="wallpaper-edge-grip"
        aria-hidden="true"
      />
    </button>
    <CoverComposition
      compact
      :inert="hidden"
      :aria-hidden="hidden || undefined"
      :track="activeTrack"
      :lines="lyrics"
      :index="lyricIndex"
      :energy="snapshot.status === 'playing' ? snapshot.energy : []"
    >
      <template #leading>
        <div class="compact-actions">
          <UiIconButton
            icon="monitor"
            :icon-size="12"
            label="桌面壁纸设置"
            @click="$emit('wallpaper')"
          />
          <UiIconButton
            icon="settings-2"
            :icon-size="12"
            label="场景设置"
            @click="$emit('settings')"
          />
        </div>
      </template>
      <template #window>
        <div class="compact-actions">
          <UiIconButton
            icon="minus"
            :icon-size="12"
            label="最小化窗口"
            @click="windowAction('minimize')"
          />
          <UiIconButton
            icon="square"
            :icon-size="10"
            label="停用壁纸并返回音乐空间"
            @click="$emit('restore')"
          />
          <UiIconButton
            icon="x"
            :icon-size="12"
            :label="preferences.closeToTray ? '隐藏到系统托盘' : '关闭窗口'"
            @click="windowAction('close')"
          />
        </div>
      </template>
      <template #progress>
        <PlaybackSeekBar
          :snapshot="snapshot"
          :disabled="!activeTrack || !snapshot.durationMs"
          :seek="seek"
        />
      </template>
      <template #controls>
        <PlaybackTransport
          expanded
          expand-label="停用壁纸并返回音乐空间"
          @queue="$emit('queue')"
          @fullscreen="$emit('restore')"
        />
      </template>
    </CoverComposition>
  </section>
</template>

<style scoped>
.wallpaper-player {
  position: fixed;
  inset: 0;
  z-index: var(--z-scene);
  overflow: hidden;
  border-radius: 0;
}
.wallpaper-player :deep(.cover-composition) {
  border: 0;
  border-radius: 0;
  background:
    radial-gradient(ellipse at 0 0, #dfe9dd29, transparent 60%),
    linear-gradient(120deg, #26322d80, #111b168f 64%, #25312b80);
  box-shadow: inset 1px 1px #ffffff1c;
  backdrop-filter: blur(32px) saturate(1.35);
  transition: transform 180ms cubic-bezier(0.333333, 1, 0.666667, 1);
}
.wallpaper-player.is-retracted :deep(.cover-composition) {
  transform: translateX(calc(100% - 12px));
}
.wallpaper-player :deep(.cover-chrome) {
  cursor: default;
}
.wallpaper-edge {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  border-radius: 0;
  background: #b7c6b92e;
  box-shadow: inset 1px 0 #e1e8dc59;
}
.wallpaper-edge-grip {
  width: 2px;
  height: 34px;
  background: #d4decbb3;
}
.wallpaper-edge:focus-visible {
  outline-offset: -2px;
}
.compact-actions {
  display: flex;
  align-items: center;
  gap: 1px;
}
.compact-actions :deep(button) {
  width: 24px;
  height: 26px;
  min-height: 0;
  border-radius: 3px;
  color: #a4aaa0;
}
.wallpaper-player :deep(.transport-primary) {
  gap: 10px;
}
.wallpaper-player :deep(.transport-button) {
  width: 30px;
  height: 36px;
}
.wallpaper-player :deep(.transport-play svg) {
  width: 24px;
  height: 24px;
}
.wallpaper-player :deep(.expanded > button) {
  width: 26px;
  height: 36px;
}
</style>
