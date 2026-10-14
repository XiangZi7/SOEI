import { watch } from 'vue'
import { useDocumentVisibility, useRafFn } from '@vueuse/core'
import type { ReadableValue } from './timeSource'

/** 单个 DOM 舞台一条帧循环；时间跳转直接求帧，不重演入场动画。 */
export function useVisualizerFrame(options: {
  source: () => ReadableValue<number>
  running: () => boolean
  paint: () => void
  frameRate?: () => number
}) {
  const visibility = useDocumentVisibility()
  const running = () => options.running() && visibility.value !== 'hidden'
  const { pause, resume } = useRafFn(options.paint, {
    immediate: false,
    fpsLimit: () => options.frameRate?.() ?? 30,
  })
  watch(
    options.source,
    (source, _previous, onCleanup) => {
      const unsubscribe = source.subscribe?.(() => {
        if (!running() && visibility.value !== 'hidden') options.paint()
      })
      if (unsubscribe) onCleanup(unsubscribe)
    },
    { immediate: true }
  )
  watch(
    running,
    enabled => {
      options.paint()
      if (enabled) resume()
      else pause()
    },
    { immediate: true, flush: 'post' }
  )
}
