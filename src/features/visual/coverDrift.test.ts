import { describe, expect, it } from 'vitest'
import { buildCoverDriftTrack } from './coverDrift'

function parseTransform(transform: string) {
  const match = transform.match(
    /translate3d\((-?[\d.]+)%, (-?[\d.]+)%, 0\) scale\(([\d.]+)\)/
  )
  if (!match) throw new Error(`无法解析 transform: ${transform}`)
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    scale: Number(match[3]),
  }
}

describe('封面漂移轨道', () => {
  it('首尾关键帧相同，循环无缝', () => {
    const { keyframes } = buildCoverDriftTrack(1)
    expect(keyframes[0].transform).toBe(
      keyframes[keyframes.length - 1].transform
    )
  })
  it('缩放始终大于两倍最大位移，平移不会露出图片边缘', () => {
    for (const strength of [0.25, 0.5, 1]) {
      const track = buildCoverDriftTrack(strength)
      for (const keyframe of track.keyframes) {
        const { x, y, scale } = parseTransform(String(keyframe.transform))
        // 元素放大 scale 后，每侧多出的余量是 (scale-1)/2，必须盖住该方向的位移。
        const margin = ((scale - 1) / 2) * 100
        expect(margin).toBeGreaterThan(Math.abs(x))
        expect(margin).toBeGreaterThan(Math.abs(y))
      }
    }
  })
  it('位移用满预算：极值恰好顶到 maxTravelPercent', () => {
    const track = buildCoverDriftTrack(1)
    const peak = track.keyframes.reduce((max, keyframe) => {
      const { x, y } = parseTransform(String(keyframe.transform))
      return Math.max(max, Math.abs(x), Math.abs(y))
    }, 0)
    expect(peak).toBeCloseTo(track.maxTravelPercent, 3)
  })
  it('强度为 0 时完全静止，但仍保留最小过扫描', () => {
    const track = buildCoverDriftTrack(0)
    expect(track.maxTravelPercent).toBe(0)
    expect(track.minScale).toBeGreaterThan(1)
    const transforms = new Set(
      track.keyframes.map(keyframe => keyframe.transform)
    )
    expect(transforms.size).toBe(1)
  })
  it('强度越界时截断而不是外推', () => {
    expect(buildCoverDriftTrack(5)).toEqual(buildCoverDriftTrack(1))
    expect(buildCoverDriftTrack(-1)).toEqual(buildCoverDriftTrack(0))
  })
  it('一圈 240 秒', () => {
    expect(buildCoverDriftTrack(1).durationMs).toBe(240_000)
  })
})
