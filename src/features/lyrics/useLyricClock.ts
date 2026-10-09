import { computed, readonly, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useRafFn } from '@vueuse/core'
import type { PlaybackSnapshot } from '../../types/music'
import { projectLyricPosition } from './playbackClock'

/** 歌词帧间插值保留在组件作用域，不修改播放器的真实进度。 */
export function useLyricClock(
  snapshot: () => PlaybackSnapshot,
  active: () => boolean = () => true
) {
  const positionMs = shallowRef(0)
  const visibility = useDocumentVisibility()
  let sampledAt = 0
  const interpolating = computed(
    () =>
      active() &&
      visibility.value === 'visible' &&
      snapshot().status === 'playing' &&
      snapshot().trackId !== null
  )

  function calibrate() {
    sampledAt = performance.now()
    positionMs.value = projectLyricPosition(snapshot(), 0)
  }
  function render(timestamp: number) {
    positionMs.value = projectLyricPosition(
      snapshot(),
      interpolating.value ? timestamp - sampledAt : 0
    )
  }
  const { pause, resume } = useRafFn(({ timestamp }) => render(timestamp), {
    immediate: false,
  })

  // 独立侦听原始值，音量、能量等快照更新不能重置计时锚点。
  watch(
    [
      () => snapshot().positionMs,
      () => snapshot().status,
      () => snapshot().sessionId,
      () => snapshot().trackId,
    ],
    calibrate,
    { immediate: true, flush: 'sync' }
  )
  watch(
    () => snapshot().durationMs,
    () => render(performance.now()),
    { flush: 'sync' }
  )
  watch(
    interpolating,
    enabled => {
      if (enabled) {
        // 重新可见时以最新快照重新起算，不补上隐藏期间的时间。
        calibrate()
        resume()
      } else pause()
    },
    { immediate: true, flush: 'sync' }
  )

  return { positionMs: readonly(positionMs) }
}
