import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref } from 'vue'
import type { PlaybackSnapshot } from '../../types/music'
import { projectPlaybackPosition, usePlaybackSeek } from './usePlaybackSeek'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))
function setup() {
  const snapshot = reactive<PlaybackSnapshot>({
    sessionId: 1,
    revision: 1,
    trackId: 'song',
    status: 'playing',
    positionMs: 1000,
    durationMs: 36000,
    volume: 1,
    repeatMode: 'sequential',
    queue: [],
    energy: [],
    error: null,
  })
  const replies: ((ok: boolean) => void)[] = []
  const seek = vi.fn(
    (positionMs: number) =>
      new Promise<boolean>(resolve => {
        replies.push(ok => {
          if (ok) snapshot.positionMs = positionMs
          resolve(ok)
        })
      })
  )
  const scope = effectScope()
  scopes.push(scope)
  const controller = scope.run(() => usePlaybackSeek(() => snapshot, seek))!
  return { snapshot, seek, replies, controller, scope }
}
const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('播放进度操作', () => {
  it('桌面端替换整个快照时，同一首歌曲的拖动草稿仍被保留', () => {
    const { snapshot } = setup()
    const source = ref({ ...snapshot })
    const scope = effectScope()
    scopes.push(scope)
    const controller = scope.run(() =>
      usePlaybackSeek(
        () => source.value,
        async () => true
      )
    )!
    controller.preview(24000)
    source.value = { ...source.value, revision: 2, positionMs: 1500 }
    expect(controller.positionMs.value).toBe(24000)
    expect(controller.state.scrubbing).toBe(true)
  })
  it('拖动与等待确认时，播放器旧进度不会覆盖目标位置', async () => {
    const { snapshot, controller, seek, replies } = setup()
    controller.begin()
    controller.preview(24000)
    snapshot.positionMs = 1250
    expect(controller.positionMs.value).toBe(24000)
    expect(seek).not.toHaveBeenCalled()
    controller.commit()
    controller.commit() // 原生 change 与 pointerup 只提交一次。
    snapshot.positionMs = 1500
    expect(controller.positionMs.value).toBe(24000)
    expect(seek).toHaveBeenCalledExactlyOnceWith(24000)
    replies.shift()!(true)
    await settle()
    expect(controller.positionMs.value).toBe(24000)
    expect(controller.state.pending).toBe(false)
  })
  it('连续跳转保留最后的位置，旧确认不能让滑块回跳', async () => {
    const { controller, seek, replies } = setup()
    for (const value of [18000, 22000, 28000]) {
      controller.preview(value)
      controller.commit()
    }
    expect(seek.mock.calls).toEqual([[18000]])
    replies.shift()!(true)
    await settle()
    expect(controller.positionMs.value).toBe(28000)
    expect(seek.mock.calls).toEqual([[18000], [28000]])
    replies.shift()!(true)
    await settle()
    expect(controller.positionMs.value).toBe(28000)
    expect(controller.state.pending).toBe(false)
  })
  it('切歌或卸载后不提交上一首排队的跳转', async () => {
    const { snapshot, controller, seek, replies } = setup()
    controller.preview(18000)
    controller.commit()
    controller.preview(24000)
    controller.commit()
    snapshot.sessionId++
    replies.shift()!(true)
    await settle()
    expect(seek).toHaveBeenCalledTimes(1)
    expect(controller.state.draftMs).toBeNull()
  })
  it('失败与取消恢复真实进度，暂停时也能提交准确的跳转', async () => {
    const { snapshot, controller, replies } = setup()
    snapshot.status = 'paused'
    controller.preview(99000)
    expect(controller.positionMs.value).toBe(36000)
    controller.cancel()
    expect(controller.positionMs.value).toBe(1000)
    controller.preview(8000)
    controller.commit()
    replies.shift()!(false)
    await settle()
    expect(controller.positionMs.value).toBe(1000)
    expect(controller.state.pending).toBe(false)
  })
  it('平滑显示不越过曲尾，也不会在停止上报后无限前进', () => {
    expect(projectPlaybackPosition(1000, 36000, 125)).toBe(1125)
    expect(projectPlaybackPosition(35950, 36000, 125)).toBe(36000)
    expect(projectPlaybackPosition(1000, 36000, 9000)).toBe(1500)
  })
})
