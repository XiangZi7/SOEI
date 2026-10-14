import { onScopeDispose, watch, type Ref } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'

import { buildCoverDriftTrack } from './coverDrift'

/**
 * 用 Web Animations API 播放封面漂移。关键帧一次性交给合成器，
 * 之后不再有逐帧 JS —— 所以这层氛围动效几乎不占主线程。
 *
 * 页面隐藏时暂停（而不是取消），恢复后从原来的相位继续，画面不会跳。
 */
export function useCoverDrift(
  element: Ref<HTMLElement | null>,
  options: () => { strength: number; reducedMotion: boolean }
) {
  const visibility = useDocumentVisibility()
  let animation: Animation | undefined
  let appliedStrength = -1

  function stop() {
    animation?.cancel()
    animation = undefined
    appliedStrength = -1
  }

  function sync() {
    const target = element.value
    const { strength, reducedMotion } = options()
    if (!target || reducedMotion || strength <= 0) {
      stop()
      return
    }
    // 没有 WAAPI 时静默跳过：CSS 的静态过扫描仍然保证画面完整。
    if (typeof target.animate !== 'function') return
    if (appliedStrength !== strength) {
      stop()
      const track = buildCoverDriftTrack(strength)
      animation = target.animate(track.keyframes, {
        duration: track.durationMs,
        iterations: Infinity,
        easing: 'linear',
      })
      appliedStrength = strength
    }
    if (!animation) return
    if (visibility.value === 'visible') void animation.play()
    else animation.pause()
  }

  watch(
    [
      element,
      visibility,
      () => options().strength,
      () => options().reducedMotion,
    ],
    sync,
    { immediate: true, flush: 'post' }
  )
  onScopeDispose(stop)
}
