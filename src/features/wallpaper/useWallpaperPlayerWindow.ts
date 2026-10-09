import { onScopeDispose, watch, type Ref } from 'vue'
import { call, desktop } from '../../bridge/native'

/** 串行切换窗口尺寸，避免快速启停时旧请求覆盖恢复后的窗口。 */
export function useWallpaperPlayerWindow(
  enabled: Ref<boolean>,
  report: (error: unknown) => void
) {
  let pending = Promise.resolve()
  watch(
    enabled,
    (compact, previous) => {
      document.documentElement.classList.toggle(
        'wallpaper-player-active',
        compact
      )
      if (!desktop || (previous === undefined && !compact)) return
      pending = pending
        .then(() =>
          call<void>('window_action', {
            action: compact ? 'wallpaper-player' : 'restore-player',
          })
        )
        .catch(report)
    },
    { immediate: true }
  )
  onScopeDispose(() =>
    document.documentElement.classList.remove('wallpaper-player-active')
  )
}
