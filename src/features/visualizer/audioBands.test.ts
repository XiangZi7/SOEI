import { describe, expect, it } from 'vitest'
import { createAudioSource } from './audioBands'

describe('音频频段适配', () => {
  it('按 ENERGY_SLOTS 的顺序映射槽位', () => {
    const source = createAudioSource()
    source.apply([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
    expect(source.power.get()).toBe(0.1)
    expect(source.bands.bass.get()).toBe(0.2)
    expect(source.bands.lowMid.get()).toBe(0.3)
    expect(source.bands.mid.get()).toBe(0.4)
    expect(source.bands.vocal.get()).toBe(0.5)
    expect(source.bands.treble.get()).toBe(0.6)
  })
  it('初始全为 0', () => {
    const source = createAudioSource()
    expect(source.power.get()).toBe(0)
    expect(source.bands.treble.get()).toBe(0)
  })
  it('限幅到 0..1', () => {
    const source = createAudioSource()
    source.apply([5, -3, 1, 0, 0, 0])
    expect(source.power.get()).toBe(1)
    expect(source.bands.bass.get()).toBe(0)
    expect(source.bands.lowMid.get()).toBe(1)
  })
  it('非有限值与缺失槽位按 0 处理，不编造数据', () => {
    const source = createAudioSource()
    source.apply([Number.NaN, Number.POSITIVE_INFINITY])
    expect(source.power.get()).toBe(0)
    expect(source.bands.bass.get()).toBe(0)
    expect(source.bands.treble.get()).toBe(0)
    source.apply(undefined)
    expect(source.power.get()).toBe(0)
  })
  it('旧的 4 槽数据不会污染新增频段', () => {
    const source = createAudioSource()
    // 升级前的快照只有 4 个值；vocal / treble 必须归零而不是沿用旧值。
    source.apply([0.9, 0.8, 0.7, 0.6, 0.5, 0.4])
    source.apply([0.1, 0.2, 0.3, 0.4])
    expect(source.bands.vocal.get()).toBe(0)
    expect(source.bands.treble.get()).toBe(0)
  })
  it('频谱保持 undefined：原生快照约 8Hz，不足以驱动频谱柱', () => {
    expect(createAudioSource().bands.spectrum).toBeUndefined()
  })
})
