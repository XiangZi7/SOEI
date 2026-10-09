import { describe, expect, it } from 'vitest'
import type { LyricLine } from '../../types/music'
import { buildGlyphTimings } from './glyphTiming'

const line: LyricLine = {
  id: 'line',
  startMs: 1000,
  text: '你好世界',
  words: [
    { text: '你好', startMs: 1000, endMs: 2000 },
    { text: '世界', startMs: 2500 },
  ],
}
const glyphs = ['你', '好', '世', '界']

describe('词时间与显示字素对齐', () => {
  it('词内均分字素，保留显式停顿，末词以行结束时间收尾', () => {
    expect(buildGlyphTimings(line, 4000, glyphs)).toEqual([
      { startMs: 1000, endMs: 1500 },
      { startMs: 1500, endMs: 2000 },
      { startMs: 2500, endMs: 3250 },
      { startMs: 3250, endMs: 4000 },
    ])
  })

  it('缺失的非末词结束时间取下一词起点，不覆盖明确给出的词尾', () => {
    const untimedEnd = {
      ...line,
      words: [
        { text: '你好', startMs: 1000 },
        { text: '世界', startMs: 3000, endMs: 5000 },
      ],
    }
    expect(buildGlyphTimings(untimedEnd, 4500, glyphs)).toEqual([
      { startMs: 1000, endMs: 2000 },
      { startMs: 2000, endMs: 3000 },
      { startMs: 3000, endMs: 4000 },
      { startMs: 4000, endMs: 5000 },
    ])
  })

  it('完整 emoji 与组合字符各占一个字素，不按 UTF-16 长度分配时间', () => {
    const text = 'e\u0301👩🏽‍🚀か\u3099'
    expect(
      buildGlyphTimings(
        {
          ...line,
          text,
          words: [{ text, startMs: 1000, endMs: 4000 }],
        },
        4000,
        ['e\u0301', '👩🏽‍🚀', 'か\u3099']
      )
    ).toEqual([
      { startMs: 1000, endMs: 2000 },
      { startMs: 2000, endMs: 3000 },
      { startMs: 3000, endMs: 4000 },
    ])
  })

  it('词标签落在组合字符和 emoji 内部时合并区间，仍只显示完整字素', () => {
    expect(
      buildGlyphTimings(
        {
          ...line,
          text: 'e\u0301👩🏽‍🚀',
          words: [
            { text: 'e', startMs: 1000, endMs: 1100 },
            { text: '\u0301', startMs: 1100, endMs: 1200 },
            { text: '👩', startMs: 1200, endMs: 1300 },
            { text: '🏽‍🚀', startMs: 1300, endMs: 2000 },
          ],
        },
        2000,
        ['e\u0301', '👩🏽‍🚀']
      )
    ).toEqual([
      { startMs: 1000, endMs: 1200 },
      { startMs: 1200, endMs: 2000 },
    ])
  })

  it('长句整体或局部合并渲染时，合并已有字素区间而不重新均分整行', () => {
    expect(buildGlyphTimings(line, 4000, [line.text])).toEqual([
      { startMs: 1000, endMs: 4000 },
    ])
    expect(buildGlyphTimings(line, 4000, ['你', '好世界'])).toEqual([
      { startMs: 1000, endMs: 1500 },
      { startMs: 1500, endMs: 4000 },
    ])
  })

  it('词外空格和标点沿用相邻边界，不产生额外时间段', () => {
    expect(
      buildGlyphTimings(
        {
          ...line,
          text: '“Hi, 你！”',
          words: [
            { text: 'Hi', startMs: 1000, endMs: 2000 },
            { text: '你', startMs: 2500, endMs: 3000 },
          ],
        },
        3000,
        ['“', 'H', 'i', ',', ' ', '你', '！', '”']
      )
    ).toEqual([
      { startMs: 1000, endMs: 1000 },
      { startMs: 1000, endMs: 1500 },
      { startMs: 1500, endMs: 2000 },
      { startMs: 2000, endMs: 2000 },
      { startMs: 2000, endMs: 2000 },
      { startMs: 2500, endMs: 3000 },
      { startMs: 3000, endMs: 3000 },
      { startMs: 3000, endMs: 3000 },
    ])
  })

  it('词内标点不分走字母时间，明确单独标时的符号仍保留区间', () => {
    expect(
      buildGlyphTimings(
        {
          ...line,
          text: 'Hi, ！',
          words: [
            { text: 'Hi, ', startMs: 1000, endMs: 2000 },
            { text: '！', startMs: 2500, endMs: 3000 },
          ],
        },
        3000,
        ['H', 'i', ',', ' ', '！']
      )
    ).toEqual([
      { startMs: 1000, endMs: 1500 },
      { startMs: 1500, endMs: 2000 },
      { startMs: 2000, endMs: 2000 },
      { startMs: 2000, endMs: 2000 },
      { startMs: 2500, endMs: 3000 },
    ])
  })

  it('忽略空文本词，零时长词不产生 NaN 或虚构延长', () => {
    expect(
      buildGlyphTimings(
        {
          ...line,
          text: '你好',
          words: [
            { text: '', startMs: 1000, endMs: 1000 },
            { text: '你', startMs: 1000, endMs: 1000 },
            { text: '好', startMs: 1000, endMs: 2000 },
          ],
        },
        2000,
        ['你', '好']
      )
    ).toEqual([
      { startMs: 1000, endMs: 1000 },
      { startMs: 1000, endMs: 2000 },
    ])
  })

  it('无词时间、显示文本不一致或遗漏正文时回退到普通歌词', () => {
    expect(buildGlyphTimings({ ...line, words: undefined }, 4000, glyphs)).toBe(
      undefined
    )
    expect(buildGlyphTimings({ ...line, words: [] }, 4000, glyphs)).toBe(
      undefined
    )
    expect(buildGlyphTimings(line, 4000, ['你', '好'])).toBe(undefined)
    expect(buildGlyphTimings(line, 4000, [...glyphs, ''])).toBe(undefined)
    expect(
      buildGlyphTimings(
        { ...line, words: line.words!.slice(0, 1) },
        4000,
        glyphs
      )
    ).toBe(undefined)
  })

  it('拒绝显示端拆开的组合字素', () => {
    expect(
      buildGlyphTimings(
        {
          ...line,
          text: 'e\u0301',
          words: [{ text: 'e\u0301', startMs: 1000, endMs: 2000 }],
        },
        2000,
        ['e', '\u0301']
      )
    ).toBe(undefined)
  })

  it.each([
    { startMs: NaN, endMs: 2000 },
    { startMs: -1, endMs: 2000 },
    { startMs: 1000, endMs: Infinity },
    { startMs: 2000, endMs: 1000 },
  ])('拒绝无效词区间：%o', timing => {
    expect(
      buildGlyphTimings(
        { ...line, words: [{ text: line.text, ...timing }] },
        4000,
        glyphs
      )
    ).toBe(undefined)
  })
})
