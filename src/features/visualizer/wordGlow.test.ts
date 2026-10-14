import { describe, expect, it } from 'vitest'
import { wordGlowEnvelope, wordGlowFilter, wordGlowTiming } from './wordGlow'

describe('逐字光晕时序', () => {
  it('instant 模式封顶 0.12s，半径 14/24', () => {
    const timing = wordGlowTiming({ mode: 'instant', durationSec: 5 })
    expect(timing.durationSec).toBe(0.12)
    expect([timing.inner, timing.outer]).toEqual([14, 24])
    expect(timing.times).toEqual([0, 0.35, 1])
  })
  it('fast 模式限制在 0.12..0.2s，半径 18/32', () => {
    expect(
      wordGlowTiming({ mode: 'fast', durationSec: 0.01 }).durationSec
    ).toBe(0.12)
    expect(wordGlowTiming({ mode: 'fast', durationSec: 9 }).durationSec).toBe(
      0.2
    )
    const timing = wordGlowTiming({ mode: 'fast' })
    expect([timing.inner, timing.outer]).toEqual([18, 32])
  })
  it('sweep 有真实字素时间时按字素时长拉长 6 倍，延迟取字素相对词首的偏移', () => {
    const timing = wordGlowTiming({
      mode: 'sweep',
      durationSec: 1,
      total: 4,
      index: 2,
      wordStartSec: 10,
      charStartSec: 10.5,
      charEndSec: 10.75,
    })
    expect(timing.durationSec).toBeCloseTo(0.25 * 6, 6)
    expect(timing.delaySec).toBeCloseTo(0.5, 6)
  })
  it('sweep 没有字素时间时按词时长均分，延迟按序号推', () => {
    const timing = wordGlowTiming({
      mode: 'sweep',
      durationSec: 1,
      total: 4,
      index: 2,
    })
    expect(timing.durationSec).toBeCloseTo(0.25 * 6, 6)
    expect(timing.delaySec).toBeCloseTo(0.5, 6)
  })
  it('字素时长为 0 时不产生 0 时长包络', () => {
    const timing = wordGlowTiming({
      mode: 'sweep',
      total: 2,
      wordStartSec: 1,
      charStartSec: 1,
      charEndSec: 1,
    })
    expect(timing.durationSec).toBeGreaterThan(0)
  })
  it('单字与 CJK 走持续发光：末值仍为 1', () => {
    const timing = wordGlowTiming({ mode: 'sustained', durationSec: 0.8 })
    expect(timing.peaks[2]).toBe(1)
    expect(wordGlowEnvelope(timing, 99)).toBe(1)
  })
  it('sweep 的 total 为 1 时退化成持续发光', () => {
    const timing = wordGlowTiming({ mode: 'sweep', durationSec: 0.5, total: 1 })
    expect(timing.times).toEqual([0, 0.9, 1])
  })
})

describe('光晕包络', () => {
  const timing = wordGlowTiming({ mode: 'instant', durationSec: 0.1 })

  it('延迟之前为起始值，结束之后为末值', () => {
    expect(wordGlowEnvelope(timing, -1)).toBe(0)
    expect(wordGlowEnvelope(timing, 999)).toBe(0)
  })
  it('在峰值控制点上取到 1', () => {
    expect(wordGlowEnvelope(timing, timing.durationSec * 0.35)).toBeCloseTo(
      1,
      6
    )
  })
  it('控制点之间单调插值', () => {
    const rise = wordGlowEnvelope(timing, timing.durationSec * 0.175)
    expect(rise).toBeGreaterThan(0)
    expect(rise).toBeLessThan(1)
    const fall = wordGlowEnvelope(timing, timing.durationSec * 0.675)
    expect(fall).toBeGreaterThan(0)
    expect(fall).toBeLessThan(1)
  })
  it('尊重延迟', () => {
    const delayed = wordGlowTiming({
      mode: 'sweep',
      durationSec: 1,
      total: 2,
      index: 1,
    })
    expect(delayed.delaySec).toBeCloseTo(0.5, 6)
    expect(wordGlowEnvelope(delayed, 0.4)).toBe(0)
    expect(wordGlowEnvelope(delayed, 0.5)).toBe(0)
    expect(wordGlowEnvelope(delayed, 0.6)).toBeGreaterThan(0)
  })
})

describe('光晕 filter 输出', () => {
  const timing = wordGlowTiming({ mode: 'sustained', durationSec: 1 })

  it('强度为 0 时返回 none，不留下恒存的合成层', () => {
    expect(wordGlowFilter('#e8c879', timing, 0)).toBe('none')
    expect(wordGlowFilter('#e8c879', timing, -1)).toBe('none')
  })
  it('用 drop-shadow 而不是 text-shadow —— 这是规避 Linux 字形缓存泄漏的关键', () => {
    const filter = wordGlowFilter('#e8c879', timing, 1)
    expect(filter).toContain('drop-shadow(')
    expect(filter).not.toContain('text-shadow')
  })
  it('半径按 0.4 的拟合系数缩放，内层带 0.7 透明度', () => {
    const filter = wordGlowFilter('#e8c879', timing, 1)
    // inner 20 * 1 * 0.4 = 8，outer 40 * 1 * 0.4 = 16
    expect(filter).toContain('0 0 8.00px')
    expect(filter).toContain('0 0 16.00px')
    expect(filter).toContain('rgba(232, 200, 121, 0.7)')
  })
  it('强度缩放两个半径', () => {
    const filter = wordGlowFilter('#e8c879', timing, 0.5)
    expect(filter).toContain('0 0 4.00px')
    expect(filter).toContain('0 0 8.00px')
  })
})
