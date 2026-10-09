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
  it('解析逐词开始和结束边界，尾部时间标签不会成为空词', () => {
    const [line] = parseLrc('[00:01]<00:01.00>你<00:01.50>好<00:02.00>')
    expect(line).toEqual({
      id: '0-0',
      startMs: 1000,
      text: '你好',
      words: [
        { text: '你', startMs: 1000, endMs: 1500 },
        { text: '好', startMs: 1500, endMs: 2000 },
      ],
    })
  })
  it('保留未标注结束时间的末词，并以行时间标记首段文本', () => {
    const [line] = parseLrc('[00:01]Hello <00:01.5>world')
    expect(line?.text).toBe('Hello world')
    expect(line?.words).toEqual([
      { text: 'Hello ', startMs: 1000, endMs: 1500 },
      { text: 'world', startMs: 1500 },
    ])
  })
  it('BOM、offset 和无序重复行标签会一致地平移词时间', () => {
    const lines = parseLrc(
      '\uFEFF[offset:+250]\r\n[00:04][00:01]<00:04.00>你<00:04.50>好<00:05.00>'
    )
    expect(lines.map(line => [line.startMs, line.words])).toEqual([
      [
        1250,
        [
          { text: '你', startMs: 1250, endMs: 1750 },
          { text: '好', startMs: 1750, endMs: 2250 },
        ],
      ],
      [
        4250,
        [
          { text: '你', startMs: 4250, endMs: 4750 },
          { text: '好', startMs: 4750, endMs: 5250 },
        ],
      ],
    ])
    expect(lines[0]?.words?.[0]).not.toBe(lines[1]?.words?.[0])
    expect(new Set(lines.map(line => line.id)).size).toBe(2)
  })
  it('负 offset 同时截断行、词与结束时间，保持非负区间', () => {
    const [line] = parseLrc(
      '[offset:-1500]\n[00:01]<00:01>你<00:01.2>好<00:02>'
    )
    expect(line?.startMs).toBe(0)
    expect(line?.words).toEqual([
      { text: '你', startMs: 0, endMs: 0 },
      { text: '好', startMs: 0, endMs: 500 },
    ])
  })
  it.each([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1000])(
    '行或词平移溢出时整份文件忽略 offset，保留 1ms 边界：%i',
    offset => {
      const lines = parseLrc(
        `[offset:${offset}]\n[00:00]序\n[00:01]<00:01>a<00:01.001>b<00:01.002>`
      )
      expect(lines.map(line => line.startMs)).toEqual([0, 1000])
      expect(lines[1]?.words).toEqual([
        { text: 'a', startMs: 1000, endMs: 1001 },
        { text: 'b', startMs: 1001, endMs: 1002 },
      ])
    }
  )
  it.each([
    '<00:01>你<00:60>好',
    '<00:01>你<00:01.1234>好',
    '<00:01>你<00:bad>好',
    '<00:01>你<-00:02>好',
    '<00:02>你<00:01>好',
    '<00:00.50>你<00:01.50>好',
    `<00:01>你<${'9'.repeat(320)}:02>好`,
  ])('词时间非法或逆序时回退为完整普通行：%s', content => {
    const [line] = parseLrc(`[00:01]${content}`)
    expect(line?.text).toBe('你好')
    expect(line).not.toHaveProperty('words')
  })
  it('连续边界保留词间停顿，同时允许同时间的词', () => {
    const [line] = parseLrc('[00:01]<00:01>你<00:01>好<00:02><00:03>！<00:04>')
    expect(line?.text).toBe('你好！')
    expect(line?.words).toEqual([
      { text: '你', startMs: 1000, endMs: 1000 },
      { text: '好', startMs: 1000, endMs: 2000 },
      { text: '！', startMs: 3000, endMs: 4000 },
    ])
  })
  it('不拆分组合字素，保留词间空白，只清理整行两端空白', () => {
    const [line] = parseLrc(
      '[00:01] <00:01> e\u0301 <00:01.3>👩🏽‍🚀<00:01.6>か\u3099 <00:02>'
    )
    expect(line?.text).toBe('e\u0301 👩🏽‍🚀か\u3099')
    expect(line?.words?.map(word => word.text)).toEqual([
      'e\u0301 ',
      '👩🏽‍🚀',
      'か\u3099',
    ])
    expect(line?.words?.map(word => word.text).join('')).toBe(line?.text)
  })
  it('普通歌词保留尖括号文本，只有时间标签的空行仍被忽略', () => {
    const lines = parseLrc('[00:01]I <3 you <verse>\n[00:02]<00:02><00:03>')
    expect(lines).toEqual([
      { id: '0-0', startMs: 1000, text: 'I <3 you <verse>' },
    ])
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
