import { describe, expect, it } from 'vitest'
import { formatTime, lyricIndexAt, parseLrc } from './lrc'

describe('LRC 解析与播放定位', () => {
  it('接受 BOM、中日英文本、重复时间标签和毫秒精度', () => {
    const lines = parseLrc(
      '\uFEFF[ar:测试]\r\n[00:12.3][01:02.045]星の光 / hello 世界\r\n[00:05:12]前一句'
    )
    expect(lines.map(line => [line.startMs, line.text])).toEqual([
      [5120, '前一句'],
      [12300, '星の光 / hello 世界'],
      [62045, '星の光 / hello 世界'],
    ])
    expect(new Set(lines.map(line => line.id)).size).toBe(3)
  })
  it('应用文件 offset，不产生负时间，忽略元数据、空白和非法秒数', () => {
    expect(
      parseLrc(
        '[offset:-1000]\n[00:00.20]开始\n[00:03]第二句\n[00:60]非法\n[00:04] \n无时间文本'
      ).map(line => line.startMs)
    ).toEqual([0, 2000])
  })
  it('Seek 可前后定位，开始前、末句及同时间标签有确定行为', () => {
    const lines = parseLrc('[00:01]A\n[00:05]B\n[00:05]C\n[00:09]D')
    expect(
      [0, 1000, 4999, 5000, 99999, 2000].map(time => lyricIndexAt(lines, time))
    ).toEqual([-1, 0, 0, 2, 3, 0])
    expect(lyricIndexAt([], 100)).toBe(-1)
  })
  it('进度显示截断毫秒并处理负值', () => {
    expect([0, 59999, 60000, 3600000, -10].map(formatTime)).toEqual([
      '0:00',
      '0:59',
      '1:00',
      '60:00',
      '0:00',
    ])
  })
})
