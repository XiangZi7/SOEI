import { describe, expect, it } from 'vitest'
import type { Line } from '../lyrics/folia/model'
import {
  getRecentCompletedLine,
  getUpcomingLine,
  getUpcomingLines,
  prepareActiveAndUpcoming,
  shouldPreheatLine,
  visualizerRuntime,
} from './runtime'
import { mutableValue } from './timeSource'

const line = (startTime: number, endTime: number, fullText = ''): Line => ({
  words: [],
  startTime,
  endTime,
  fullText,
})

// 上游的 Line 用秒。
const lines = [line(0, 2, 'a'), line(2, 4, 'b'), line(4, 6, 'c')]

describe('visualizer 运行时窗口', () => {
  it('有活跃行时不返回「刚唱完的行」', () => {
    expect(
      getRecentCompletedLine({ lines, currentLineIndex: 1, currentTime: 3 })
    ).toBeNull()
  })
  it('间隙中返回最后一句已唱完的行，供字幕继续显示', () => {
    expect(
      getRecentCompletedLine({ lines, currentLineIndex: -1, currentTime: 5 })
        ?.fullText
    ).toBe('b')
    expect(
      getRecentCompletedLine({ lines, currentLineIndex: -1, currentTime: 999 })
        ?.fullText
    ).toBe('c')
  })
  it('开头之前没有已唱完的行', () => {
    expect(
      getRecentCompletedLine({ lines, currentLineIndex: -1, currentTime: 0 })
    ).toBeNull()
    expect(
      getRecentCompletedLine({
        lines: [],
        currentLineIndex: -1,
        currentTime: 9,
      })
    ).toBeNull()
  })
  it('可以自定义行结束时间', () => {
    expect(
      getRecentCompletedLine({
        lines,
        currentLineIndex: -1,
        currentTime: 5,
        // 把结束时间推后，于是 5 秒时还没有任何一行算唱完。
        getLineEndTime: candidate => candidate.endTime + 10,
      })
    ).toBeNull()
  })
  it('有活跃行时 upcoming 就是数组里的下一行', () => {
    expect(getUpcomingLine(lines, 0, 1)?.fullText).toBe('b')
    expect(getUpcomingLine(lines, 2, 5)).toBeNull()
  })
  it('还没有活跃行时 upcoming 是第一行尚未开始的行', () => {
    expect(getUpcomingLine(lines, -1, 0)?.fullText).toBe('b')
    expect(getUpcomingLine(lines, -1, -1)?.fullText).toBe('a')
    expect(getUpcomingLine(lines, -1, 99)).toBeNull()
  })
  it('前瞻若干行，索引为负时返回空', () => {
    expect(getUpcomingLines(lines, 0).map(item => item.fullText)).toEqual([
      'b',
      'c',
    ])
    expect(getUpcomingLines(lines, 0, 1).map(item => item.fullText)).toEqual([
      'b',
    ])
    expect(getUpcomingLines(lines, -1)).toEqual([])
  })
  it('预热窗口按提前时间判断，两端都包含', () => {
    const window = { minLead: 0.5, maxLead: 2 }
    // 距开始还有 1.5 秒，落在窗口内。
    expect(shouldPreheatLine(lines[1], 0.5, window)).toBe(true)
    // 还有 2 秒，正好是上界。
    expect(shouldPreheatLine(lines[1], 0, window)).toBe(true)
    // 只剩 0.4 秒，太晚了。
    expect(shouldPreheatLine(lines[1], 1.6, window)).toBe(false)
    // 还有 4 秒，太早了。
    expect(shouldPreheatLine(lines[2], 0, window)).toBe(false)
    expect(shouldPreheatLine(null, 0, window)).toBe(false)
  })
  it('没有活跃行时只预热下一行，且不返回状态', () => {
    const prepared: string[] = []
    const result = prepareActiveAndUpcoming({
      activeLine: null,
      upcomingLine: lines[1],
      prepareLine: candidate => {
        prepared.push(candidate?.fullText ?? 'null')
        return candidate?.fullText ?? null
      },
    })
    expect(result).toBeNull()
    expect(prepared).toEqual(['b'])
  })
  it('有活跃行时先准备活跃行再预热下一行，只返回活跃行的状态', () => {
    const prepared: string[] = []
    const result = prepareActiveAndUpcoming({
      activeLine: lines[0],
      upcomingLine: lines[1],
      prepareLine: candidate => {
        prepared.push(candidate?.fullText ?? 'null')
        return candidate?.fullText ?? null
      },
    })
    expect(result).toBe('a')
    expect(prepared).toEqual(['a', 'b'])
  })
  it('运行时打包从时间源读取当前时间', () => {
    const currentTime = mutableValue(3)
    const bundle = visualizerRuntime({
      currentTime,
      currentLineIndex: 1,
      lines,
    })
    expect(bundle.currentTimeValue).toBe(3)
    expect(bundle.activeLine?.fullText).toBe('b')
    expect(bundle.upcomingLine?.fullText).toBe('c')
    expect(bundle.recentCompletedLine).toBeNull()
    expect(bundle.nextLines.map(item => item.fullText)).toEqual(['c'])
  })
})

describe('非响应式时间源', () => {
  it('读写保持 .get() 调用形态，不引入响应式', () => {
    const value = mutableValue(0)
    expect(value.get()).toBe(0)
    value.set(12.5)
    expect(value.get()).toBe(12.5)
  })
})
