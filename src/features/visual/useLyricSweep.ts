import { nextTick, onScopeDispose, watch, type Ref } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import {
  clearLyricMeasurements,
  lyricTokenFrame,
  measureTokenOffsets,
  type LyricDisplayToken,
} from '../lyrics/renderModel'

// Measurements and node discovery happen only when content, geometry or fonts change.
export function useLyricSweep(
  root: Ref<HTMLElement | null>,
  tokens: () => LyricDisplayToken[],
  options: () => {
    positionMs: number
    endMs: number
    reducedMotion: boolean
    active: boolean
  }
) {
  let disposed = false
  let measured: {
    element: HTMLElement
    token: LyricDisplayToken
    offsets: number[]
    fontPx: number
  }[] = []
  function paint() {
    const current = options()
    for (const item of measured) {
      const frame = lyricTokenFrame(
        item.token,
        current.positionMs,
        item.offsets,
        item.fontPx,
        current.endMs,
        current.reducedMotion
      )
      const fill = `${frame.fillPx.toFixed(2)}px`
      if (item.element.style.getPropertyValue('--sweep') !== fill)
        item.element.style.setProperty('--sweep', fill)
      const glow = current.active ? (frame.glow * 5).toFixed(2) : '0'
      if (item.element.style.getPropertyValue('--glow') !== glow)
        item.element.style.setProperty('--glow', glow)
      if (item.element.dataset.status !== frame.status)
        item.element.dataset.status = frame.status
    }
  }
  async function measure() {
    await nextTick()
    if (disposed || !root.value) return
    const elements =
      root.value.querySelectorAll<HTMLElement>('[data-sweep-token]')
    measured = []
    for (const element of elements) {
      const token = tokens()[Number(element.dataset.sweepToken)]
      if (!token?.timed) continue
      const style = getComputedStyle(element)
      const fontPx = parseFloat(style.fontSize) || 24
      const offsets = measureTokenOffsets(
        token.text,
        fontPx,
        `${style.fontWeight} ${fontPx}px ${style.fontFamily}`
      )
      const width = element.offsetWidth
      const measuredWidth = offsets[offsets.length - 1] ?? 1
      measured.push({
        element,
        token,
        fontPx,
        offsets: offsets.map(
          value => (value * width) / Math.max(1, measuredWidth)
        ),
      })
      element.style.setProperty(
        '--sweep-edge',
        `${Math.max(6, Math.min(16, fontPx * 0.45))}px`
      )
    }
    paint()
  }
  watch(tokens, measure, { immediate: true, flush: 'post' })
  watch(
    () => [options().positionMs, options().active, options().reducedMotion],
    paint,
    { flush: 'post' }
  )
  useResizeObserver(root, measure)
  useResizeObserver(() => root.value?.parentElement, measure)
  if (typeof document !== 'undefined') {
    useEventListener(document.fonts, 'loadingdone', () => {
      clearLyricMeasurements()
      void measure()
    })
    void document.fonts?.ready.then(() => {
      if (!disposed) void measure()
    })
  }
  onScopeDispose(() => {
    disposed = true
    measured = []
  })
}
