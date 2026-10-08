import { computed, onScopeDispose, reactive, watch } from 'vue'
import type { PlaybackSnapshot } from '../../types/music'

// 保留用户正在选择的位置，直到对应跳转完成；连续跳转按顺序提交。
export function usePlaybackSeek(
  snapshot: () => PlaybackSnapshot,
  seek: (positionMs: number) => Promise<boolean>,
  disabled: () => boolean = () => false
) {
  const state = reactive({
    // 指针或键盘正在选择的位置
    draftMs: null as number | null,
    // 当前是否还在操作滑块
    scrubbing: false,
    // 是否正在等待播放器确认
    pending: false,
  })
  let version = 0
  let disposed = false
  let queued: { positionMs: number; version: number } | null = null
  let running = false

  const positionMs = computed(() => state.draftMs ?? snapshot().positionMs)
  const clamp = (value: number) =>
    Math.round(Math.max(0, Math.min(snapshot().durationMs, value)))

  function begin() {
    if (disabled()) return
    version++
    state.scrubbing = true
    state.draftMs = clamp(positionMs.value)
  }
  function preview(value: number) {
    if (disabled() || !Number.isFinite(value)) return
    if (!state.scrubbing) begin()
    state.draftMs = clamp(value)
  }
  function reset() {
    version++
    queued = null
    state.draftMs = null
    state.scrubbing = false
    state.pending = false
  }
  async function flush() {
    if (running) return
    running = true
    try {
      while (queued && !disposed) {
        const request = queued
        queued = null
        // 旧跳转的确认不能覆盖较新的拖动或跳转。
        try {
          await seek(request.positionMs)
        } finally {
          if (request.version === version && !disposed) {
            state.draftMs = null
            state.pending = false
          }
        }
      }
    } finally {
      running = false
    }
  }
  function commit() {
    if (!state.scrubbing || state.draftMs === null || disabled()) return
    state.scrubbing = false
    state.pending = true
    queued = { positionMs: state.draftMs, version: ++version }
    void flush()
  }

  watch(
    [() => snapshot().trackId, () => snapshot().sessionId, disabled],
    reset,
    {
      flush: 'sync',
    }
  )
  onScopeDispose(() => {
    disposed = true
    reset()
  })
  return { positionMs, state, begin, preview, commit, cancel: reset }
}

// 只插值播放中的显示位置；暂停和拖动仍使用准确的播放器时间。
export function projectPlaybackPosition(
  positionMs: number,
  durationMs: number,
  elapsedMs: number
) {
  return Math.min(
    durationMs,
    positionMs + Math.max(0, Math.min(500, elapsedMs))
  )
}
