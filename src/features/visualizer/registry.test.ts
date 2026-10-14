import { describe, expect, it } from 'vitest'
import { hasVisualizer, visualizerEntries, visualizerEntry } from './registry'

describe('模式注册表', () => {
  it('通过 glob 自动发现 entry，不需要维护手写清单', () => {
    const modes = visualizerEntries().map(entry => entry.mode)
    expect(modes).toContain('still')
    expect(modes).toContain('classic')
  })
  it('按 order 排序', () => {
    const orders = visualizerEntries().map(entry => entry.order)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })
  it('每个 entry 都具备注册表契约要求的字段', () => {
    for (const entry of visualizerEntries()) {
      expect(typeof entry.mode).toBe('string')
      expect(entry.mode).not.toBe('')
      expect(typeof entry.label).toBe('string')
      expect(typeof entry.description).toBe('string')
      expect(typeof entry.order).toBe('number')
      expect(entry.component).toBeTruthy()
    }
  })
  it('mode 不重复', () => {
    const modes = visualizerEntries().map(entry => entry.mode)
    expect(new Set(modes).size).toBe(modes.length)
  })
  it('renderer 是异步组件，避免把全部模式拉进同一个 chunk', () => {
    for (const entry of visualizerEntries()) {
      // defineAsyncComponent 产出的是带 setup 的对象，而不是直接的 SFC 选项。
      expect(typeof entry.component).toBe('object')
      expect(entry.component).toHaveProperty('setup')
    }
  })
  it('按 id 查询，未注册时返回 undefined', () => {
    expect(visualizerEntry('still')?.mode).toBe('still')
    expect(visualizerEntry('nope')).toBeUndefined()
    expect(visualizerEntry(undefined)).toBeUndefined()
  })
  it('hasVisualizer 用于决定是否回落到原有 CSS 场景', () => {
    expect(hasVisualizer('still')).toBe(true)
    expect(hasVisualizer('classic')).toBe(true)
    expect(visualizerEntry('classic')?.usesWordSegmentation).toBe(true)
    // SOEI 原有的七个 CSS 场景不在 visualizer 注册表里，必须回落。
    for (const legacy of [
      'manuscript',
      'artistic',
      'collage',
      'echo',
      'montage',
      'readable',
      'title',
    ])
      expect(hasVisualizer(legacy)).toBe(false)
    expect(hasVisualizer(undefined)).toBe(false)
  })
  it('still 刻意不挂背景层', () => {
    expect(visualizerEntry('still')?.rendersBackground).toBe(false)
  })
})
