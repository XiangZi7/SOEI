import { describe, expect, it } from 'vitest'
import { clamp01, cubicBezier, easing, lerp, springStep } from './easing'

describe('cubic-bezier 求值', () => {
  const tilt = easing(0.25, 0.46, 0.45, 0.94)

  it('两端精确命中 0 与 1', () => {
    expect(cubicBezier(0.25, 0.46, 0.45, 0.94, 0)).toBe(0)
    expect(cubicBezier(0.25, 0.46, 0.45, 0.94, 1)).toBe(1)
  })
  it('越界进度被截断', () => {
    expect(tilt(-5)).toBe(0)
    expect(tilt(9)).toBe(1)
  })
  it('在 [0,1] 上单调递增', () => {
    let previous = -1
    for (let progress = 0; progress <= 1; progress += 0.02) {
      const value = tilt(progress)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
  it('线性曲线退化成恒等映射', () => {
    const linear = easing(0, 0, 1, 1)
    for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9])
      expect(linear(progress)).toBeCloseTo(progress, 10)
  })
  it('缓出曲线前段快于线性', () => {
    // 0.25/0.46/0.45/0.94 是一条 ease-out：中点应当已经越过一半。
    expect(tilt(0.5)).toBeGreaterThan(0.5)
  })
  it('ease-in-out 关于中点近似对称', () => {
    const inOut = easing(0.42, 0, 0.58, 1)
    expect(inOut(0.5)).toBeCloseTo(0.5, 3)
    expect(inOut(0.25) + inOut(0.75)).toBeCloseTo(1, 2)
  })
  it('与浏览器 ease-out 的已知取值吻合', () => {
    // cubic-bezier(0, 0, 0.58, 1) 即 CSS 的 ease-out。
    const easeOut = easing(0, 0, 0.58, 1)
    expect(easeOut(0.25)).toBeCloseTo(0.4, 1)
    expect(easeOut(0.5)).toBeCloseTo(0.69, 1)
  })
  it('输出始终落在 0..1', () => {
    const curves: [number, number, number, number][] = [
      [0.25, 0.46, 0.45, 0.94],
      [0.22, 1, 0.36, 1],
      [0.42, 0, 0.58, 1],
    ]
    for (const [x1, y1, x2, y2] of curves)
      for (let progress = 0; progress <= 1; progress += 0.05) {
        const value = cubicBezier(x1, y1, x2, y2, progress)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
  })
})

describe('插值辅助', () => {
  it('clamp01 夹取到 0..1', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(3)).toBe(1)
  })
  it('lerp 在两端精确命中', () => {
    expect(lerp(2, 8, 0)).toBe(2)
    expect(lerp(2, 8, 1)).toBe(8)
    expect(lerp(2, 8, 0.5)).toBe(5)
  })
})
