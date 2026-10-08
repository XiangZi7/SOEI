<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useDocumentVisibility, useRafFn } from '@vueuse/core'
import type { PlaybackSnapshot } from '../../types/music'
import { formatTime } from '../lyrics/lrc'
import { projectPlaybackPosition, usePlaybackSeek } from './usePlaybackSeek'

const props = defineProps<{
  snapshot: PlaybackSnapshot
  disabled?: boolean
  preview?: boolean
  seek: (positionMs: number) => Promise<boolean>
}>()
const controller = usePlaybackSeek(
  () => props.snapshot,
  positionMs => props.seek(positionMs),
  () => Boolean(props.disabled)
)
const visibility = useDocumentVisibility()
// 响应式状态
const state = reactive({
  // 帧间平滑显示的播放时间
  renderedMs: props.snapshot.positionMs,
  // 上次真实进度的到达时间
  updatedAt: performance.now(),
})
const interpolating = computed(
  () =>
    !props.disabled &&
    props.snapshot.status === 'playing' &&
    visibility.value === 'visible' &&
    !controller.state.scrubbing &&
    !controller.state.pending
)
const { pause, resume } = useRafFn(
  ({ timestamp }) => {
    state.renderedMs = projectPlaybackPosition(
      props.snapshot.positionMs,
      props.snapshot.durationMs,
      timestamp - state.updatedAt
    )
  },
  { immediate: false }
)
watch(
  () => [
    props.snapshot.positionMs,
    props.snapshot.status,
    props.snapshot.sessionId,
  ],
  () => {
    state.updatedAt = performance.now()
    state.renderedMs = props.snapshot.positionMs
  },
  { flush: 'sync' }
)
watch(interpolating, active => (active ? resume() : pause()), {
  immediate: true,
})
const position = computed(() =>
  controller.state.draftMs !== null
    ? controller.positionMs.value
    : interpolating.value
      ? state.renderedMs
      : props.snapshot.positionMs
)
const progress = computed(() =>
  props.snapshot.durationMs
    ? (position.value / props.snapshot.durationMs) * 100
    : 0
)
function input(event: Event) {
  controller.preview(Number((event.target as HTMLInputElement).value))
}
function pointerDown(event: PointerEvent) {
  if (event.button !== 0 || props.disabled) return
  controller.begin()
  ;(event.currentTarget as HTMLInputElement).setPointerCapture(event.pointerId)
}
function keyDown(event: KeyboardEvent) {
  const targets: Record<string, number> = {
    ArrowRight: position.value + 1000,
    ArrowUp: position.value + 1000,
    ArrowLeft: position.value - 1000,
    ArrowDown: position.value - 1000,
    PageUp: position.value + 10000,
    PageDown: position.value - 10000,
    Home: 0,
    End: props.snapshot.durationMs,
  }
  const target = targets[event.key]
  if (target === undefined || props.disabled) return
  event.preventDefault()
  controller.preview(target)
  controller.commit()
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-2.5">
    <div
      class="relative flex h-8 min-w-10 flex-1 items-center"
      :class="{ 'opacity-35': disabled }"
    >
      <div
        class="pointer-events-none absolute inset-x-1.5 h-0.75 overflow-hidden rounded-full bg-ink/25"
      >
        <div
          class="h-full rounded-full bg-accent"
          :style="{ width: progress + '%' }"
        />
      </div>
      <input
        type="range"
        min="0"
        :max="Math.max(1, snapshot.durationMs)"
        step="1"
        :value="position"
        :disabled="disabled"
        aria-label="播放进度"
        :aria-valuetext="
          formatTime(position) + ' / ' + formatTime(snapshot.durationMs)
        "
        class="relative m-0 h-8! w-full min-w-0 cursor-pointer touch-none appearance-none bg-transparent disabled:cursor-not-allowed [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-track]:h-0.75 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-0.75 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-accent"
        @pointerdown="pointerDown"
        @input="input"
        @change="controller.commit"
        @pointerup="controller.commit"
        @pointercancel="controller.cancel"
        @blur="controller.commit"
        @keydown="keyDown"
      />
    </div>
    <span class="text-[8px] whitespace-nowrap text-muted tabular-nums">{{
      preview
        ? 'PREVIEW'
        : formatTime(position) + ' / ' + formatTime(snapshot.durationMs)
    }}</span>
  </div>
</template>
