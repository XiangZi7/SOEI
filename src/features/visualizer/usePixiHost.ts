import { onScopeDispose, watch, type Ref } from 'vue'

// 命令式 Pixi 导演（tempera、sonnet、lumiere）的「只挂载一次」生命周期。
// 从 Folia pixiRuntimeHost.ts 移植，React hook 改写为 Vue composable。
//
// 上游记录的问题：这些 runtime 曾把每个与歌曲相关的输入都列进 create effect 的依赖数组，
// 于是换一首歌就销毁 WebGL 上下文、纹理池和整个场景缓存再从头重建 —— 而在整个异步重建期间
// canvas 都不在 DOM 里。这里 runtime 只创建一次，换歌像 tuning 变化那样原地交给它处理，
// 期间旧歌继续渲染，直到 runtime 准备好交接。

export interface PixiHostOptions<TRuntime, TSong> {
  /** Pixi canvas 的挂载点。 */
  host: Ref<HTMLElement | null>
  /** 控制台输出前缀，例如 `Tempera`。 */
  label: string
  /**
   * 真正需要新 runtime 的输入（整画布级设置、纹理池）。
   * 与歌曲相关的输入**不能**放这里 —— 那是 `song` 的职责。
   */
  rebuildKey: () => unknown[]
  /** 每首歌会变的一切，打成一个对象；它的引用随歌曲改变。 */
  song: () => TSong
  create: (
    host: HTMLElement,
    song: TSong,
    signal: AbortSignal
  ) => Promise<TRuntime>
  /** 把新歌应用到活跃的 runtime 上。交接完成时 resolve。 */
  swap: (
    runtime: TRuntime,
    song: TSong,
    signal: AbortSignal
  ) => Promise<void> | void
  destroy: (runtime: TRuntime) => void
  /** `create` 失败时上报，让模式可以显示纯文字兜底。 */
  onFailedChange?: (failed: boolean) => void
}

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * 返回指向活跃 runtime 的引用，供模式自己的实时更新使用
 * （setTuning、setPaused、setSongMetadata 等）。
 * 第一次 `create` resolve 之前以及销毁之后都是 null。
 */
export function usePixiHost<TRuntime, TSong>(
  options: PixiHostOptions<TRuntime, TSong>
): { runtime: () => TRuntime | null } {
  const { host, label, create, swap, destroy, onFailedChange } = options
  let runtime: TRuntime | null = null
  /** 活跃 runtime 实际在渲染的那首歌；没有 runtime 时为 null。 */
  let appliedSong: TSong | null = null
  let signal: AbortSignal | null = null
  let draining = false
  let disposed = false
  let teardown: (() => void) | undefined

  /**
   * 向**最新**的歌曲收敛，而不是每跳一首就排一次交接。
   * 跳歌比一次交接完成得更快是常事；把它们全部依次跑完会让画面在用户停手之后还擦好几秒，
   * 所以进行中的那次跑完，下一跳直接去到那时的当前曲目。
   */
  async function drainSong() {
    if (draining) return
    draining = true
    try {
      for (;;) {
        const current = runtime
        const currentSignal = signal
        const next = options.song()
        if (
          !current ||
          !currentSignal ||
          currentSignal.aborted ||
          next === appliedSong
        )
          break
        await swap(current, next, currentSignal)
        // 这次交接期间 runtime 被拆掉或重建了；替代它的那个在构建时就已经用的是当前歌曲。
        if (runtime !== current || currentSignal.aborted) break
        appliedSong = next
      }
    } catch (error) {
      // 交接失败会把上一首留在屏幕上，这比在画面里打个洞好得多。
      if (!isAbort(error))
        console.error(`[${label}] song handover failed`, error)
    } finally {
      draining = false
    }
  }

  function build() {
    teardown?.()
    teardown = undefined
    const element = host.value
    if (!element || disposed) return
    let localDisposed = false
    let created: TRuntime | null = null
    const controller = new AbortController()
    signal = controller.signal
    onFailedChange?.(false)
    // 先读，但下面会与最新值校对：Pixi 还在 import 或初始化时歌曲可能已经前进了。
    const initialSong = options.song()
    void create(element, initialSong, controller.signal)
      .then(instance => {
        if (localDisposed) {
          destroy(instance)
          return
        }
        created = instance
        runtime = instance
        appliedSong = initialSong
        void drainSong()
      })
      .catch(error => {
        if (isAbort(error)) return
        console.error(`[${label}] Pixi runtime initialization failed`, error)
        if (!localDisposed) onFailedChange?.(true)
      })
    teardown = () => {
      localDisposed = true
      controller.abort()
      if (signal === controller.signal) signal = null
      appliedSong = null
      const instance = created ?? runtime
      if (instance) destroy(instance)
      runtime = null
      element.replaceChildren()
    }
  }

  watch([host, options.rebuildKey], build, { immediate: true, flush: 'post' })
  watch(options.song, () => void drainSong(), { flush: 'post' })

  onScopeDispose(() => {
    disposed = true
    teardown?.()
    teardown = undefined
  })

  return { runtime: () => runtime }
}
