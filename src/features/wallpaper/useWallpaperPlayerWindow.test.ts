import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useWallpaperPlayerWindow } from './useWallpaperPlayerWindow'

const native = vi.hoisted(() => ({
  call: vi.fn(),
  onNative: vi.fn(),
  unlisten: vi.fn(),
}))
vi.mock('../../bridge/native', () => ({
  desktop: true,
  call: native.call,
  onNative: native.onNative,
}))

const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => {
  vi.useFakeTimers()
  native.onNative.mockResolvedValue(native.unlisten)
})

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  native.call.mockReset()
  native.onNative.mockReset()
  native.unlisten.mockReset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setup(initial = false) {
  const classList = { toggle: vi.fn(), remove: vi.fn() }
  const root = Object.assign(new EventTarget(), {
    classList,
    matches: vi.fn(() => false),
    contains: vi.fn(() => false),
  })
  const document = Object.assign(new EventTarget(), {
    documentElement: root,
    hidden: false,
  })
  const window = Object.assign(new EventTarget(), {
    matchMedia: vi.fn(() => ({ matches: false })),
  })
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', window)
  const enabled = shallowRef(initial)
  const keepOpen = shallowRef(false)
  const reducedMotion = shallowRef(false)
  const report = vi.fn()
  const scope = effectScope()
  scopes.push(scope)
  const controls = scope.run(() =>
    useWallpaperPlayerWindow(enabled, report, { keepOpen, reducedMotion })
  )!
  function hover(inside: boolean) {
    root.matches.mockReturnValue(inside)
    root.dispatchEvent(new Event(inside ? 'pointerenter' : 'pointerleave'))
  }
  return {
    enabled,
    keepOpen,
    reducedMotion,
    report,
    scope,
    classList,
    document,
    window,
    hover,
    ...controls,
  }
}

async function settle() {
  await nextTick()
  for (let index = 0; index < 8; index++) await Promise.resolve()
}

describe('壁纸播放器窗口切换', () => {
  it('普通启动不调整窗口，启停壁纸时收起和恢复，切换不发送播放命令', async () => {
    native.call.mockResolvedValue(undefined)
    const { enabled, scope, classList } = setup()
    await settle()
    expect(native.call).not.toHaveBeenCalled()
    enabled.value = true
    await settle()
    enabled.value = false
    await settle()
    expect(native.call.mock.calls).toEqual([
      ['window_action', { action: 'wallpaper-player' }],
      ['window_action', { action: 'restore-player' }],
    ])
    scope.stop()
    expect(classList.remove).toHaveBeenCalledWith('wallpaper-player-active')
  })

  it('启用尚未完成时排队恢复，避免停用后重新变成小窗', async () => {
    let finish!: () => void
    native.call.mockImplementationOnce(
      () => new Promise<void>(resolve => (finish = resolve))
    )
    native.call.mockResolvedValue(undefined)
    const { enabled, scope } = setup(true)
    await settle()
    enabled.value = false
    await settle()
    expect(native.call).toHaveBeenCalledTimes(1)
    finish()
    await settle()
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'restore-player',
    })
    scope.stop()
  })

  it('窗口缩小失败会报告错误，后续仍能恢复', async () => {
    native.call.mockRejectedValueOnce(new Error('resize failed'))
    native.call.mockResolvedValue(undefined)
    const { enabled, report, scope } = setup(true)
    await settle()
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'resize failed' })
    )
    enabled.value = false
    await settle()
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'restore-player',
    })
    scope.stop()
  })

  it('离开后延迟向右收起，短暂离开不收起，悬停窄边立即展开', async () => {
    native.call.mockResolvedValue(undefined)
    const { hover, hidden } = setup(true)
    await settle()
    hover(true)
    hover(false)
    await vi.advanceTimersByTimeAsync(300)
    hover(true)
    await vi.advanceTimersByTimeAsync(1500)
    expect(native.call).toHaveBeenCalledTimes(1)

    hover(false)
    await vi.advanceTimersByTimeAsync(650)
    expect(hidden.value).toBe(true)
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'hide-wallpaper-player',
      reducedMotion: false,
    })
    hover(true)
    await settle()
    expect(hidden.value).toBe(false)
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'show-wallpaper-player',
      reducedMotion: false,
    })
  })

  it('队列或弹窗打开时保持展开，关闭后才恢复自动收起', async () => {
    native.call.mockResolvedValue(undefined)
    const { keepOpen, hover } = setup(true)
    await settle()
    keepOpen.value = true
    await settle()
    hover(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(native.call).toHaveBeenCalledTimes(1)
    keepOpen.value = false
    await settle()
    await vi.advanceTimersByTimeAsync(650)
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'hide-wallpaper-player',
      reducedMotion: false,
    })
  })

  it('拖动进度条移出窗口不收起，松开后才计时', async () => {
    native.call.mockResolvedValue(undefined)
    const { document, hover } = setup(true)
    await settle()
    hover(true)
    document.dispatchEvent(new Event('pointerdown'))
    hover(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(native.call).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new Event('pointerup'))
    await vi.advanceTimersByTimeAsync(650)
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'hide-wallpaper-player',
      reducedMotion: false,
    })
  })

  it('键盘导航时保持展开，焦点离开窗口才收起', async () => {
    native.call.mockResolvedValue(undefined)
    const { document, window, hover } = setup(true)
    await settle()
    document.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Tab' }))
    hover(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(native.call).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('blur'))
    await vi.advanceTimersByTimeAsync(650)
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'hide-wallpaper-player',
      reducedMotion: false,
    })
  })

  it('托盘打开时同步为展开，并给用户时间移入播放器', async () => {
    native.call.mockResolvedValue(undefined)
    const { hidden } = setup(true)
    await settle()
    await vi.advanceTimersByTimeAsync(1200)
    expect(hidden.value).toBe(true)
    const listener = native.onNative.mock.calls.find(
      ([event]) => event === 'wallpaper-player:revealed'
    )![1]
    listener()
    expect(hidden.value).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(hidden.value).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(hidden.value).toBe(true)
  })

  it('托盘展开排在未完成的旧收起请求之后，避免悬停条无法恢复', async () => {
    let finishHide!: () => void
    native.call.mockImplementation((_command, args) =>
      args.action === 'hide-wallpaper-player'
        ? new Promise<void>(resolve => (finishHide = resolve))
        : Promise.resolve()
    )
    const { hidden, hover } = setup(true)
    await settle()
    hover(false)
    await vi.advanceTimersByTimeAsync(650)
    expect(hidden.value).toBe(true)
    const listener = native.onNative.mock.calls.find(
      ([event]) => event === 'wallpaper-player:revealed'
    )![1]
    listener()
    expect(hidden.value).toBe(false)
    finishHide()
    await settle()
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'show-wallpaper-player',
      reducedMotion: false,
    })
    hover(true)
    expect(hidden.value).toBe(false)
  })

  it('在窗口外松开鼠标后再次移入，不残留拖动状态', async () => {
    native.call.mockResolvedValue(undefined)
    const { document, hover } = setup(true)
    await settle()
    hover(true)
    document.dispatchEvent(new Event('pointerdown'))
    hover(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(native.call).toHaveBeenCalledTimes(1)
    // 窗外的 pointerup 未送到网页，重新进入时 buttons 为零。
    hover(true)
    hover(false)
    await vi.advanceTimersByTimeAsync(650)
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'hide-wallpaper-player',
      reducedMotion: false,
    })
  })

  it('停用壁纸取消待收起任务，恢复后不会再次移出屏幕', async () => {
    native.call.mockResolvedValue(undefined)
    const { enabled, hover, hidden } = setup(true)
    await settle()
    hover(false)
    await vi.advanceTimersByTimeAsync(300)
    enabled.value = false
    await settle()
    await vi.advanceTimersByTimeAsync(2000)
    hover(true)
    await settle()
    expect(hidden.value).toBe(false)
    expect(native.call.mock.calls).toEqual([
      ['window_action', { action: 'wallpaper-player' }],
      ['window_action', { action: 'restore-player' }],
    ])
  })

  it('收起失败不留下不可操作的内容，后续悬停仍可恢复', async () => {
    native.call.mockResolvedValue(undefined)
    const { hover, hidden, report } = setup(true)
    await settle()
    native.call.mockRejectedValueOnce(new Error('dock failed'))
    hover(false)
    await vi.advanceTimersByTimeAsync(650)
    expect(hidden.value).toBe(false)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'dock failed' })
    )
    hover(true)
    hover(false)
    await vi.advanceTimersByTimeAsync(650)
    expect(hidden.value).toBe(true)
    hover(true)
    await settle()
    expect(hidden.value).toBe(false)
  })

  it('尊重应用或系统减少动态效果设置', async () => {
    native.call.mockResolvedValue(undefined)
    const { hover, reducedMotion, window } = setup(true)
    await settle()
    reducedMotion.value = true
    hover(false)
    await vi.advanceTimersByTimeAsync(650)
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'hide-wallpaper-player',
      reducedMotion: true,
    })
    reducedMotion.value = false
    window.matchMedia.mockReturnValue({ matches: true })
    hover(true)
    await settle()
    expect(native.call).toHaveBeenLastCalledWith('window_action', {
      action: 'show-wallpaper-player',
      reducedMotion: true,
    })
  })

  it('卸载后释放事件和计时器，不再触发窗口操作', async () => {
    native.call.mockResolvedValue(undefined)
    const { scope, hover } = setup(true)
    await settle()
    hover(false)
    scope.stop()
    await vi.advanceTimersByTimeAsync(2000)
    hover(true)
    await settle()
    expect(native.call).toHaveBeenCalledTimes(1)
    expect(native.unlisten).toHaveBeenCalledOnce()
  })
})
