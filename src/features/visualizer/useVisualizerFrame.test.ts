import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useRafFn } from '@vueuse/core'
import { mutableValue } from './timeSource'
import { useVisualizerFrame } from './useVisualizerFrame'

const visibility = shallowRef<DocumentVisibilityState>('visible')
const raf = { pause: vi.fn(), resume: vi.fn() }
vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => visibility,
  useRafFn: vi.fn(() => raf),
}))
beforeEach(() => {
  visibility.value = 'visible'
  vi.clearAllMocks()
})
function harness(paused = true) {
  const scope = effectScope()
  const source = shallowRef(mutableValue(1))
  const running = shallowRef(!paused)
  const paint = vi.fn()
  scope.run(() =>
    useVisualizerFrame({
      source: () => source.value,
      running: () => running.value,
      paint,
      frameRate: () => 30,
    })
  )
  return { scope, source, running, paint }
}
describe('DOM 舞台帧循环', () => {
  it('暂停时停止持续循环，同句 Seek 仍直接重绘', () => {
    const { scope, source, paint } = harness()
    expect(raf.resume).not.toHaveBeenCalled()
    paint.mockClear()
    source.value.set(3.5)
    expect(paint).toHaveBeenCalledTimes(1)
    scope.stop()
  })
  it('播放启动循环；时间通知不会与 RAF 重复绘制', async () => {
    const { scope, source, running, paint } = harness()
    running.value = true
    await nextTick()
    expect(raf.resume).toHaveBeenCalledTimes(1)
    paint.mockClear()
    source.value.set(4)
    expect(paint).not.toHaveBeenCalled()
    running.value = false
    await nextTick()
    expect(raf.pause).toHaveBeenCalled()
    scope.stop()
  })
  it('换时间源时解绑旧源，卸载后不再绘制', async () => {
    const { scope, source, paint } = harness()
    const old = source.value
    source.value = mutableValue(2)
    await nextTick()
    paint.mockClear()
    old.set(4)
    expect(paint).not.toHaveBeenCalled()
    source.value.set(5)
    expect(paint).toHaveBeenCalledTimes(1)
    scope.stop()
    paint.mockClear()
    source.value.set(6)
    expect(paint).not.toHaveBeenCalled()
  })
  it('页面隐藏后停帧且不响应时间通知；重新可见刷新当前画面', async () => {
    const { scope, source, paint } = harness(false)
    visibility.value = 'hidden'
    await nextTick()
    paint.mockClear()
    source.value.set(6)
    expect(paint).not.toHaveBeenCalled()
    expect(raf.pause).toHaveBeenCalled()
    visibility.value = 'visible'
    await nextTick()
    expect(paint).toHaveBeenCalledTimes(1)
    scope.stop()
  })
  it('帧率受宿主的画质档约束', () => {
    const { scope } = harness()
    const options = vi.mocked(useRafFn).mock.calls[0]![1]!
    expect(
      typeof options.fpsLimit === 'function' ? options.fpsLimit() : null
    ).toBe(30)
    scope.stop()
  })
})
