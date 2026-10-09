import { computed, onScopeDispose, reactive, watch, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { call, desktop, onNative } from '../../bridge/native'

interface WallpaperWindowOptions {
  keepOpen?: Readonly<Ref<boolean>>
  reducedMotion?: Readonly<Ref<boolean>>
}

/** 管理贴边窗口与自动收起，窗口切换和悬停命令共用串行队列。 */
export function useWallpaperPlayerWindow(
  enabled: Readonly<Ref<boolean>>,
  report: (error: unknown) => void,
  options: WallpaperWindowOptions = {}
) {
  // 响应式状态
  const state = reactive({
    // 原生小窗已经完成尺寸和位置切换
    ready: false,
    // 播放器正在向右收起或已收起
    hidden: false,
    // 指针仍位于窗口内
    pointerInside: false,
    // 鼠标或触摸正在操作控件，离开窗口也不打断拖动
    pointerDown: false,
    // 键盘导航时保留完整控件
    keyboardFocus: false,
  })
  const root = document.documentElement
  let pending = Promise.resolve()
  let generation = 0
  let disposed = false
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let unlisten: (() => void) | undefined

  function clearHide() {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }

  function canHide() {
    return (
      desktop &&
      enabled.value &&
      state.ready &&
      !disposed &&
      !state.pointerInside &&
      !state.pointerDown &&
      !state.keyboardFocus &&
      !options.keepOpen?.value &&
      !document.hidden
    )
  }

  function setHidden(hidden: boolean, force = false) {
    if (!state.ready || !enabled.value || (state.hidden === hidden && !force))
      return
    const previous = state.hidden
    const request = generation
    state.hidden = hidden
    pending = pending.then(async () => {
      if (
        disposed ||
        request !== generation ||
        !enabled.value ||
        state.hidden !== hidden
      )
        return
      try {
        await call('window_action', {
          action: hidden ? 'hide-wallpaper-player' : 'show-wallpaper-player',
          reducedMotion:
            !!options.reducedMotion?.value ||
            !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        })
      } catch (error) {
        if (request === generation && state.hidden === hidden)
          state.hidden = previous
        report(error)
      }
    })
  }

  function scheduleHide(delay = 650) {
    clearHide()
    if (!canHide()) return
    hideTimer = setTimeout(() => {
      if (canHide()) setHidden(true)
    }, delay)
  }

  function reveal(force = false) {
    clearHide()
    setHidden(false, force)
  }

  // 主窗口整体接收事件，弹层与队列不会被当成“离开播放器”。
  useEventListener(root, 'pointerenter', event => {
    state.pointerInside = true
    state.pointerDown = !!event.buttons
    reveal()
  })
  useEventListener(root, 'pointerleave', () => {
    state.pointerInside = false
    scheduleHide()
  })
  useEventListener(document, 'pointerdown', () => {
    state.pointerDown = true
    state.keyboardFocus = false
    reveal()
  })
  useEventListener(document, ['pointerup', 'pointercancel'], () => {
    state.pointerDown = false
    state.pointerInside = root.matches(':hover')
    scheduleHide()
  })
  useEventListener(document, 'keydown', event => {
    if (event.key === 'Tab') {
      state.keyboardFocus = true
      reveal()
    }
  })
  useEventListener(document, 'focusin', event => {
    if ((event.target as HTMLElement).matches?.(':focus-visible')) {
      state.keyboardFocus = true
      reveal()
    }
  })
  useEventListener(document, 'focusout', event => {
    if (!event.relatedTarget || !root.contains(event.relatedTarget as Node)) {
      state.keyboardFocus = false
      scheduleHide()
    }
  })
  useEventListener(window, 'blur', () => {
    state.pointerInside = false
    state.pointerDown = false
    state.keyboardFocus = false
    scheduleHide()
  })
  useEventListener(document, 'visibilitychange', () => {
    clearHide()
    if (!document.hidden) scheduleHide(1200)
  })

  if (desktop) {
    void onNative('wallpaper-player:revealed', () => {
      // 托盘已展开原生窗口，仍需排队覆盖尚未完成的旧收起请求。
      reveal(true)
      state.pointerInside = root.matches(':hover')
      scheduleHide(1200)
    })
      .then(cleanup => {
        if (disposed) cleanup()
        else unlisten = cleanup
      })
      .catch(report)
  }

  watch(
    enabled,
    (compact, previous) => {
      const request = ++generation
      clearHide()
      state.ready = false
      state.hidden = false
      state.pointerDown = false
      state.keyboardFocus = false
      root.classList.toggle('wallpaper-player-active', compact)
      if (!desktop || (previous === undefined && !compact)) return
      pending = pending
        .then(async () => {
          if (disposed) return
          await call<void>('window_action', {
            action: compact ? 'wallpaper-player' : 'restore-player',
          })
          if (request !== generation || disposed || !compact) return
          state.ready = true
          state.pointerInside = root.matches(':hover')
          scheduleHide(1200)
        })
        .catch(report)
    },
    { immediate: true }
  )

  watch(
    () => options.keepOpen?.value,
    keepOpen => {
      if (keepOpen) reveal()
      else scheduleHide()
    }
  )

  onScopeDispose(() => {
    disposed = true
    generation++
    clearHide()
    unlisten?.()
    root.classList.remove('wallpaper-player-active')
  })

  return { hidden: computed(() => state.hidden), reveal }
}
