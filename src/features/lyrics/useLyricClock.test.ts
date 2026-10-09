import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, isReadonly, ref, shallowRef } from 'vue'
import type { PlaybackSnapshot } from '../../types/music'

const scopes: ReturnType<typeof effectScope>[] = []
const frames = new Map<number, FrameRequestCallback>()
const document = Object.assign(new EventTarget(), {
  visibilityState: 'visible' as DocumentVisibilityState,
})
let now = 0
let frameId = 0
const window = {
  document,
  requestAnimationFrame(callback: FrameRequestCallback) {
    frames.set(++frameId, callback)
    return frameId
  },
  cancelAnimationFrame(id: number) {
    frames.delete(id)
  },
}
let useLyricClock: typeof import('./useLyricClock').useLyricClock

beforeEach(async () => {
  now = 0
  frames.clear()
  document.visibilityState = 'visible'
  vi.stubGlobal('window', window)
  vi.stubGlobal('document', document)
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  // 在浏览器环境就绪后加载真实 VueUse，测试 RAF 与可见性监听的清理。
  ;({ useLyricClock } = await import('./useLyricClock'))
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function frameAt(timestamp: number) {
  now = timestamp
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach(callback => callback(timestamp))
}
function setVisibility(value: DocumentVisibilityState) {
  document.visibilityState = value
  document.dispatchEvent(new Event('visibilitychange'))
}
function setup() {
  const source = ref<PlaybackSnapshot>({
    sessionId: 1,
    revision: 1,
    trackId: 'song',
    status: 'playing',
    positionMs: 1000,
    durationMs: 36000,
    volume: 1,
    repeatMode: 'sequential',
    queue: ['song'],
    energy: [],
    error: null,
  })
  const active = shallowRef(true)
  const scope = effectScope()
  scopes.push(scope)
  const clock = scope.run(() =>
    useLyricClock(
      () => source.value,
      () => active.value
    )
  )!
  function publish(update: Partial<PlaybackSnapshot>) {
    source.value = {
      ...source.value,
      revision: source.value.revision + 1,
      ...update,
    }
  }
  return { source, active, scope, clock, publish }
}

describe('歌词组件媒体时钟', () => {
  it('本地插值不会写回快照，音量与能量更新也不会让游标回跳', () => {
    const { source, clock, publish } = setup()
    expect(isReadonly(clock.positionMs)).toBe(true)
    frameAt(125)
    expect(clock.positionMs.value).toBe(1125)
    expect(source.value.positionMs).toBe(1000)

    publish({ volume: 0.5, energy: [0.8, 0.2] })
    expect(clock.positionMs.value).toBe(1125)
    frameAt(250)
    expect(clock.positionMs.value).toBe(1250)
    frameAt(9000)
    expect(clock.positionMs.value).toBe(1500)
  })

  it('暂停和停止立即采用真实位置，恢复播放从该位置重新计时', () => {
    const { clock, publish } = setup()
    frameAt(125)
    publish({ status: 'paused', positionMs: 1100 })
    expect(clock.positionMs.value).toBe(1100)
    expect(frames.size).toBe(0)
    frameAt(3000)
    expect(clock.positionMs.value).toBe(1100)

    publish({ status: 'playing' })
    frameAt(3125)
    expect(clock.positionMs.value).toBe(1225)
    publish({ status: 'stopped', positionMs: 0 })
    expect(clock.positionMs.value).toBe(0)
    expect(frames.size).toBe(0)
  })

  it('同一歌曲内前后 Seek 都立即校准，不依赖歌词行或播放会话变化', () => {
    const { source, clock, publish } = setup()
    frameAt(200)
    publish({ positionMs: 1800 })
    expect(clock.positionMs.value).toBe(1800)
    frameAt(250)
    expect(clock.positionMs.value).toBe(1850)

    source.value.positionMs = 1200
    expect(clock.positionMs.value).toBe(1200)
    frameAt(300)
    expect(clock.positionMs.value).toBe(1250)
  })

  it('位置数值相同时，重新播放和切歌仍会重置旧计时锚点', () => {
    const { clock, publish } = setup()
    frameAt(300)
    publish({ sessionId: 2 })
    expect(clock.positionMs.value).toBe(1000)
    frameAt(350)
    expect(clock.positionMs.value).toBe(1050)

    publish({ trackId: 'next' })
    expect(clock.positionMs.value).toBe(1000)
    frameAt(400)
    expect(clock.positionMs.value).toBe(1050)
  })

  it('场景未启用时停止 RAF，但继续接收真实进度，恢复时不累计隐藏时间', () => {
    const { source, active, clock, publish } = setup()
    frameAt(125)
    active.value = false
    expect(frames.size).toBe(0)
    expect(source.value.status).toBe('playing')
    frameAt(3000)
    publish({ positionMs: 4000 })
    expect(clock.positionMs.value).toBe(4000)
    frameAt(5000)

    active.value = true
    expect(clock.positionMs.value).toBe(4000)
    frameAt(5125)
    expect(clock.positionMs.value).toBe(4125)
  })

  it('页面隐藏时取消 RAF，重新可见时从最新快照继续', () => {
    const { clock, publish } = setup()
    frameAt(125)
    setVisibility('hidden')
    expect(frames.size).toBe(0)
    frameAt(4000)
    publish({ positionMs: 5000 })
    frameAt(6000)

    setVisibility('visible')
    expect(clock.positionMs.value).toBe(5000)
    frameAt(6125)
    expect(clock.positionMs.value).toBe(5125)
  })

  it('总时长只修正曲尾边界，不重置插值进度', () => {
    const { clock, publish } = setup()
    frameAt(200)
    publish({ durationMs: 1100 })
    expect(clock.positionMs.value).toBe(1100)
    publish({ durationMs: 36000 })
    expect(clock.positionMs.value).toBe(1200)
    frameAt(300)
    expect(clock.positionMs.value).toBe(1300)
  })

  it('卸载作用域清理 RAF 和页面监听，后续快照不能再更新游标', () => {
    const removeListener = vi.spyOn(document, 'removeEventListener')
    const { scope, clock, publish } = setup()
    frameAt(125)
    scope.stop()
    expect(frames.size).toBe(0)
    expect(removeListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
      expect.objectContaining({ passive: true })
    )
    publish({ positionMs: 5000 })
    setVisibility('hidden')
    setVisibility('visible')
    frameAt(1000)
    expect(clock.positionMs.value).toBe(1125)
    expect(frames.size).toBe(0)
  })
})
