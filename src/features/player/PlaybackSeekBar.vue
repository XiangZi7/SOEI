<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import { useDocumentVisibility, useRafFn } from '@vueuse/core'
import type { PlaybackSnapshot } from '../../types/music'
import { formatTime } from '../lyrics/lrc'
import { projectPlaybackPosition, usePlaybackSeek } from './usePlaybackSeek'

const props = defineProps<{
  snapshot: PlaybackSnapshot
  disabled?: boolean
  preview?: boolean
  rail?: boolean
  seek: (positionMs: number) => Promise<boolean>
}>()
const controller = usePlaybackSeek(
  () => props.snapshot,
  positionMs => props.seek(positionMs),
  () => Boolean(props.disabled)
)
const visibility = useDocumentVisibility()
const tooltipId = useId()
// 响应式状态
const state = reactive({
  // 帧间平滑显示的播放时间
  renderedMs: props.snapshot.positionMs,
  // 上次真实进度的到达时间
  updatedAt: performance.now(),
  // 悬停只预览时间，不改变真实播放位置。
  hoveredMs: null as number | null,
  hoverRatio: 0,
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
const tooltipVisible = computed(
  () =>
    props.rail &&
    !props.disabled &&
    props.snapshot.durationMs > 0 &&
    state.hoveredMs !== null
)
const tooltipPosition = computed(() =>
  controller.state.scrubbing
    ? position.value
    : state.hoveredMs === null
      ? position.value
      : state.hoverRatio * props.snapshot.durationMs
)
const tooltipRatio = computed(() =>
  state.hoveredMs === null || controller.state.scrubbing
    ? progress.value
    : state.hoverRatio * 100
)
function pointerMove(event: PointerEvent) {
  if (props.disabled || !props.rail || !props.snapshot.durationMs) return
  const bounds = (
    event.currentTarget as HTMLInputElement
  ).getBoundingClientRect()
  if (
    !bounds.width ||
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  ) {
    state.hoveredMs = null
    return
  }
  state.hoverRatio = Math.max(
    0,
    Math.min(1, (event.clientX - bounds.left) / bounds.width)
  )
  state.hoveredMs = state.hoverRatio * props.snapshot.durationMs
}
function pointerLeave() {
  state.hoveredMs = null
}
function blur() {
  state.hoveredMs = null
  controller.commit()
}
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
  state.hoveredMs = null
  controller.preview(target)
  controller.commit()
}
</script>

<template>
  <div
    class="seek-bar"
    :class="{ rail }"
  >
    <div class="seek-hit-area">
      <div class="seek-track">
        <div
          class="seek-progress"
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
        :aria-describedby="tooltipVisible ? tooltipId : undefined"
        class="seek-input"
        @pointerdown="pointerDown"
        @pointerenter="pointerMove"
        @pointermove="pointerMove"
        @pointerleave="pointerLeave"
        @input="input"
        @change="controller.commit"
        @pointerup="controller.commit"
        @pointercancel="controller.cancel"
        @blur="blur"
        @keydown="keyDown"
      />
      <Transition name="fade"
        ><span
          v-if="tooltipVisible"
          :id="tooltipId"
          class="seek-bubble"
          role="tooltip"
          :style="{ left: `clamp(52px, ${tooltipRatio}%, calc(100% - 52px))` }"
          >{{ formatTime(tooltipPosition)
          }}<span class="seek-bubble-total">
            / {{ formatTime(snapshot.durationMs) }}</span
          ></span
        ></Transition
      >
    </div>
    <span
      v-if="!rail"
      class="seek-time"
      >{{
        preview
          ? 'PREVIEW'
          : formatTime(position) + ' / ' + formatTime(snapshot.durationMs)
      }}</span
    >
  </div>
</template>

<style scoped>
.seek-bar {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rail .seek-hit-area {
  position: absolute;
  width: auto;
  left: 85px;
  right: 34px;
  bottom: 4px;
  height: 12px;
}
.seek-bubble {
  position: absolute;
  bottom: calc(100% + 8px);
  z-index: 2;
  transform: translateX(-50%);
  pointer-events: none;
  padding: 7px 10px;
  border: 1px solid #b6c1b438;
  border-radius: 5px;
  background: #111914ed;
  box-shadow: 0 4px 16px #0006;
  color: #eeeede;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  backdrop-filter: blur(12px);
}
.seek-bubble::after {
  position: absolute;
  top: calc(100% - 3px);
  left: calc(50% - 3px);
  width: 6px;
  height: 6px;
  content: '';
  transform: rotate(45deg);
  border-right: 1px solid #b6c1b438;
  border-bottom: 1px solid #b6c1b438;
  background: #111914;
}
.seek-bubble-total {
  color: #afb7a9;
}
.seek-hit-area {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 16px;
}
.seek-track {
  position: absolute;
  inset-inline: 0;
  height: 1px;
  background: #e0e1d32e;
  pointer-events: none;
}
.seek-progress {
  height: 100%;
  background: #e6e6d9;
}
.seek-input {
  position: relative;
  width: 100%;
  min-width: 0;
  height: 24px !important;
  margin: 0;
  appearance: none;
  touch-action: none;
  background: transparent;
}
.seek-input::-webkit-slider-runnable-track {
  height: 1px;
  background: transparent;
}
.seek-input::-webkit-slider-thumb {
  width: 4px;
  height: 4px;
  margin-top: -1.5px;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: #efeee3;
  opacity: 0;
}
.seek-input::-moz-range-track {
  height: 1px;
  background: transparent;
}
.seek-input::-moz-range-thumb {
  width: 4px;
  height: 4px;
  border: 0;
  border-radius: 50%;
  background: #efeee3;
  opacity: 0;
}
.seek-input:is(:hover, :focus-visible):not(:disabled)::-webkit-slider-thumb {
  opacity: 1;
}
.seek-input:is(:hover, :focus-visible):not(:disabled)::-moz-range-thumb {
  opacity: 1;
}
.seek-time {
  font-size: 9px;
  line-height: 1.4;
  white-space: nowrap;
  letter-spacing: 0.015em;
  color: #a1a69c;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 740px) {
  .rail .seek-hit-area {
    left: 54px;
    right: 30px;
    bottom: 0;
  }
  .seek-time {
    font-size: 8px;
  }
}
</style>
