<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { call, desktop } from '../../bridge/native'
import { UiIconButton } from '../../components/ui'
import CoverComposition from '../visual/CoverComposition.vue'
import PlaybackSeekBar from '../player/PlaybackSeekBar.vue'
import PlaybackTransport from '../player/PlaybackTransport.vue'
import { lyricIndexAt } from '../lyrics/lrc'

defineEmits<{ queue: []; wallpaper: []; settings: []; restore: [] }>()
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
</script>

<template>
  <section
    class="wallpaper-player"
    aria-label="壁纸模式播放器"
  >
    <CoverComposition
      compact
      :track="activeTrack"
      :lines="lyrics"
      :index="lyricIndex"
      :energy="snapshot.status === 'playing' ? snapshot.energy : []"
      @drag="windowAction('drag')"
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
            label="关闭窗口"
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
