import { describe, expect, it } from 'vitest'
import {
  snapResolutionToTexturePool,
  texturePoolAxis,
  TEXTURE_POOL_MAX_RESOLUTION_DROP,
} from './pixiTextureBudget'

describe('Pixi 纹理池预算', () => {
  it('轴向尺寸向上取到二次幂', () => {
    expect(texturePoolAxis(100, 1)).toBe(128)
    expect(texturePoolAxis(128, 1)).toBe(128)
    expect(texturePoolAxis(129, 1)).toBe(256)
    expect(texturePoolAxis(781, 1.5)).toBe(2048)
  })
  it('恰好落在边界上不会因浮点误差被取回上一级', () => {
    // 1024 / 781 的分辨率应当正好落在 1024 桶里，而不是 2048。
    expect(texturePoolAxis(781, 1024 / 781)).toBe(1024)
  })
  it('吸附到更小的桶：上游记录的 781×850 案例', () => {
    const snapped = snapResolutionToTexturePool(781, 850, 1.5)
    expect(snapped).toBeLessThan(1.5)
    expect(snapped).toBeCloseTo(1.2047, 3)
    // 两个轴都从 2048 降到 1024。
    expect(texturePoolAxis(781, snapped)).toBe(1024)
    expect(texturePoolAxis(850, snapped)).toBe(1024)
  })
  it('按桶面积而非让出多少来排序候选', () => {
    // 上游案例：1030×520 在 1.0 下，为高度吸附能多赚一半。
    const snapped = snapResolutionToTexturePool(1030, 520, 1)
    expect(texturePoolAxis(1030, snapped)).toBe(1024)
    expect(texturePoolAxis(520, snapped)).toBe(512)
  })
  it('最近边界太远时保留申请的分辨率', () => {
    // 2000×1200 在 1.5 下需要降到约 1.024，超过 25% 的容忍度。
    expect(snapResolutionToTexturePool(2000, 1200, 1.5)).toBe(1.5)
  })
  it('让出的分辨率绝不超过 maxDrop', () => {
    for (const [w, h] of [
      [781, 850],
      [1030, 520],
      [640, 640],
      [700, 700],
      [1920, 1080],
      [333, 999],
    ] as const) {
      const snapped = snapResolutionToTexturePool(w, h, 1.5)
      expect(snapped).toBeGreaterThanOrEqual(
        1.5 * (1 - TEXTURE_POOL_MAX_RESOLUTION_DROP)
      )
      expect(snapped).toBeLessThanOrEqual(1.5)
    }
  })
  it('吸附后的桶面积绝不会变大', () => {
    for (const [w, h] of [
      [781, 850],
      [1030, 520],
      [640, 640],
      [700, 700],
      [1920, 1080],
      [120, 90],
    ] as const) {
      const before = texturePoolAxis(w, 1.5) * texturePoolAxis(h, 1.5)
      const snapped = snapResolutionToTexturePool(w, h, 1.5)
      expect(
        texturePoolAxis(w, snapped) * texturePoolAxis(h, snapped)
      ).toBeLessThanOrEqual(before)
    }
  })
  it('非法输入原样返回分辨率', () => {
    expect(snapResolutionToTexturePool(0, 100, 1.5)).toBe(1.5)
    expect(snapResolutionToTexturePool(100, -1, 1.5)).toBe(1.5)
    expect(snapResolutionToTexturePool(100, 100, Number.NaN)).toBeNaN()
    expect(
      snapResolutionToTexturePool(Number.POSITIVE_INFINITY, 100, 1.5)
    ).toBe(1.5)
  })
  it('maxDrop 为 0 时禁用吸附', () => {
    expect(snapResolutionToTexturePool(781, 850, 1.5, 0)).toBe(1.5)
  })
})
