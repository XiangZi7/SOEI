import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useWallpaperPlayerWindow } from './useWallpaperPlayerWindow'

const native = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('../../bridge/native', () => ({ desktop: true, call: native.call }))

afterEach(() => {
  native.call.mockReset()
  vi.unstubAllGlobals()
})

function setup(initial = false) {
  const classList = { toggle: vi.fn(), remove: vi.fn() }
  vi.stubGlobal('document', { documentElement: { classList } })
  const enabled = shallowRef(initial)
  const report = vi.fn()
  const scope = effectScope()
  scope.run(() => useWallpaperPlayerWindow(enabled, report))
  return { enabled, report, scope, classList }
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
})
