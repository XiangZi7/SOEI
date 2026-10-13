import { onBeforeUnmount, onMounted, reactive, computed } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { desktop } from '../../bridge/native'

/**
 * 窗口外观状态。圆角只在「透明窗口且未最大化/全屏」时生效 ——
 * 最大化后仍然保留圆角会在屏幕四角露出桌面。
 */
export function useWindowChrome() {
  const state = reactive({ maximized: false, fullscreen: false })
  let unlisten: (() => void) | undefined
  let disposed = false

  async function sync() {
    if (!desktop) return
    const current = getCurrentWindow()
    const [maximized, fullscreen] = await Promise.all([
      current.isMaximized(),
      current.isFullscreen(),
    ])
    if (disposed) return
    state.maximized = maximized
    state.fullscreen = fullscreen
  }

  onMounted(async () => {
    if (!desktop) return
    await sync()
    // onResized 覆盖最大化/还原/拖拽缩放；全屏切换也会触发一次尺寸变化。
    const stop = await getCurrentWindow().onResized(() => void sync())
    if (disposed) stop()
    else unlisten = stop
  })

  onBeforeUnmount(() => {
    disposed = true
    unlisten?.()
  })

  const rounded = computed(
    () => desktop && !state.maximized && !state.fullscreen
  )

  return { state, rounded, sync }
}
