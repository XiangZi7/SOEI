import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import type { LyricLine } from '../../types/music'
import { FALLBACK_DUAL_THEME } from '../theme/sanitize'
import {
  useVisualizerBridge,
  type VisualizerBridgeInput,
} from './useVisualizerBridge'

const line = (startMs: number, text: string, endMs?: number): LyricLine => ({
  id: `${startMs}`,
  startMs,
  text,
  timing: 'line',
  ...(endMs === undefined ? {} : { endMs }),
})

function bridge(overrides: Partial<VisualizerBridgeInput> = {}) {
  const state = reactive<VisualizerBridgeInput>({
    positionMs: 0,
    lines: [line(0, 'a'), line(2000, 'b'), line(4000, 'c')],
    index: 0,
    theme: FALLBACK_DUAL_THEME.dark,
    track: null,
    ...overrides,
  })
  const scope = effectScope()
  const result = scope.run(() => useVisualizerBridge(() => state))!
  return { state, shared: result.shared, scope }
}

describe('visualizer 桥接', () => {
  it('宿主每次构造输入快照时，播放位置变化仍不重新转换整首歌词', async () => {
    const state = reactive<VisualizerBridgeInput>({
      positionMs: 0,
      lines: [line(0, 'a'), line(4000, 'b')],
      index: 0,
      theme: FALLBACK_DUAL_THEME.dark,
      track: null,
    })
    const scope = effectScope()
    const shared = scope.run(() =>
      useVisualizerBridge(() => ({ ...state }))
    )!.shared
    const first = shared.value.lines
    state.positionMs = 1234
    await nextTick()
    expect(shared.value.lines).toBe(first)
    scope.stop()
  })

  it('毫秒转秒：上游 currentTime 与 Line 内部都用秒', async () => {
    const { state, shared } = bridge({ positionMs: 2500 })
    expect(shared.value.currentTime.get()).toBe(2.5)
    state.positionMs = 7250
    await nextTick()
    expect(shared.value.currentTime.get()).toBe(7.25)
    expect(shared.value.lines[1]!.startTime).toBe(2)
  })

  it('行结束时间依次回落到下一行开始、整首时长、固定兜底', () => {
    const { shared } = bridge({ durationMs: 9000 })
    const lines = shared.value.lines
    // 第 0 行没有 endMs，取下一行的开始。
    expect(lines[0]!.endTime).toBe(2)
    expect(lines[1]!.endTime).toBe(4)
    // 最后一行取整首时长。
    expect(lines[2]!.endTime).toBe(9)
  })

  it('没有整首时长时最后一行用固定兜底', () => {
    const { shared } = bridge()
    expect(shared.value.lines[2]!.endTime).toBe(8)
  })

  it('行自带 endMs 时优先使用', () => {
    const { shared } = bridge({ lines: [line(0, 'a', 1200), line(2000, 'b')] })
    expect(shared.value.lines[0]!.endTime).toBe(1.2)
  })

  it('时间源实例稳定：换歌词也不重建，Pixi runtime 始终读同一个对象', async () => {
    const { state, shared } = bridge()
    const time = shared.value.currentTime
    const bands = shared.value.audioBands
    state.lines = [line(0, 'x')]
    state.positionMs = 500
    await nextTick()
    expect(shared.value.currentTime).toBe(time)
    expect(shared.value.audioBands).toBe(bands)
  })

  it('歌词只在内容变化时重新转换，而不是每次读取都转', async () => {
    const { state, shared } = bridge()
    const first = shared.value.lines
    state.positionMs = 1234
    await nextTick()
    // 位置变化不应导致整首歌词重新转换。
    expect(shared.value.lines).toBe(first)
    state.lines = [line(0, 'y')]
    await nextTick()
    expect(shared.value.lines).not.toBe(first)
  })

  it('音频槽位按 ENERGY_SLOTS 顺序接入', async () => {
    const { state, shared } = bridge()
    state.energy = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
    await nextTick()
    expect(shared.value.audioPower.get()).toBe(0.1)
    expect(shared.value.audioBands.bass.get()).toBe(0.2)
    expect(shared.value.audioBands.treble.get()).toBe(0.6)
  })

  it('曲目元数据与封面接入，无曲目时为 null', async () => {
    const { state, shared } = bridge()
    expect(shared.value.songTitle).toBeNull()
    expect(shared.value.coverUrl).toBeNull()
    state.track = {
      id: 't',
      localPath: '',
      title: '光的回声',
      artist: '测试',
      album: '专辑',
      durationMs: 1000,
      coverRef: 'cover.jpg',
      lyricRef: null,
      favorite: false,
      lastPlayed: null,
    }
    await nextTick()
    expect(shared.value.songTitle).toBe('光的回声')
    expect(shared.value.songAlbum).toBe('专辑')
    expect(shared.value.coverUrl).toBe('cover.jpg')
  })

  it('歌词为空时产出空数组而不是抛错', () => {
    const { shared } = bridge({ lines: [], index: -1 })
    expect(shared.value.lines).toEqual([])
    expect(shared.value.currentLineIndex).toBe(-1)
  })

  it('定位回调原样透传', () => {
    const state = reactive<VisualizerBridgeInput>({
      positionMs: 0,
      lines: [],
      index: -1,
      theme: FALLBACK_DUAL_THEME.dark,
      track: null,
    })
    const seen: number[] = []
    const scope = effectScope()
    const result = scope.run(() =>
      useVisualizerBridge(
        () => state,
        seconds => seen.push(seconds)
      )
    )!
    result.shared.value.onLyricLineSeek?.(12.5)
    expect(seen).toEqual([12.5])
    scope.stop()
  })
})
