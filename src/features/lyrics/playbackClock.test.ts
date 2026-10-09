import { describe, expect, it } from 'vitest'
import { projectLyricPosition } from './playbackClock'

const playing = {
  positionMs: 1000,
  durationMs: 36000,
  status: 'playing',
}

describe('歌词媒体时间投影', () => {
  it('在真实进度之间平滑推进，并将最大外推限制为 500ms', () => {
    expect(projectLyricPosition(playing, 125.5)).toBe(1125.5)
    expect(projectLyricPosition(playing, 500)).toBe(1500)
    expect(projectLyricPosition(playing, 9000)).toBe(1500)
  })

  it.each(['paused', 'stopped', 'loading'])('%s 状态保持准确位置', status => {
    expect(projectLyricPosition({ ...playing, status }, 400)).toBe(1000)
  })

  it('不越过曲尾，尚未取得总时长时也能显示播放进度', () => {
    expect(projectLyricPosition({ ...playing, positionMs: 35950 }, 125)).toBe(
      36000
    )
    expect(projectLyricPosition({ ...playing, durationMs: 500 }, 0)).toBe(500)
    expect(projectLyricPosition({ ...playing, durationMs: 0 }, 125)).toBe(1125)
  })

  it('负数和无效时间不会产生负进度或 NaN', () => {
    expect(projectLyricPosition(playing, -100)).toBe(1000)
    expect(projectLyricPosition(playing, NaN)).toBe(1000)
    expect(projectLyricPosition(playing, Infinity)).toBe(1000)
    expect(projectLyricPosition({ ...playing, positionMs: -50 }, 0)).toBe(0)
    expect(projectLyricPosition({ ...playing, positionMs: NaN }, 0)).toBe(0)
    expect(projectLyricPosition({ ...playing, durationMs: NaN }, 100)).toBe(
      1100
    )
  })
})
