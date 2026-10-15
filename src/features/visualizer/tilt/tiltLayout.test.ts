import { describe, expect, it } from 'vitest'
import type { Line, Word } from '../../lyrics/folia/model'
import { FALLBACK_DUAL_THEME } from '../../theme/sanitize'
import {
  tiltCharFrame,
  tiltCharPulse,
  tiltCharScale,
  tiltSegmentFrame,
  tiltSegmentRevealStart,
  tiltVisibleSegmentIndex,
} from './tiltFrame'
import {
  buildTiltCharTimings,
  buildTiltLayout,
  buildTiltSegmentTimings,
  DEFAULT_TILT_TUNING,
  determineLineCount,
  findSegmentWordRange,
  resolveTiltTuning,
  seededRandom,
  tiltColors,
  tiltGraphemes,
} from './tiltLayout'

const word = (text: string, startTime: number, endTime: number): Word => ({
  text,
  startTime,
  endTime,
})
const makeLine = (words: Word[], fullText?: string): Line => ({
  words,
  startTime: words[0]?.startTime ?? 0,
  endTime: words[words.length - 1]?.endTime ?? 1,
  fullText: fullText ?? words.map(item => item.text).join(''),
})
const theme = FALLBACK_DUAL_THEME.dark

describe('tilt 调参', () => {
  it('缺省值与上游 DEFAULT_TILT_TUNING 一致', () => {
    expect(resolveTiltTuning()).toEqual(DEFAULT_TILT_TUNING)
    expect(DEFAULT_TILT_TUNING).toEqual({
      splitProbability: 0.75,
      tiltStyleProbability: 0.35,
      colorScheme: 'default',
    })
  })
  it('概率限幅在 0..1，非法配色退回 default', () => {
    expect(resolveTiltTuning({ splitProbability: 9 }).splitProbability).toBe(1)
    expect(
      resolveTiltTuning({ tiltStyleProbability: -2 }).tiltStyleProbability
    ).toBe(0)
    expect(resolveTiltTuning({ colorScheme: 'nope' }).colorScheme).toBe(
      'default'
    )
    expect(resolveTiltTuning({ colorScheme: 'swap' }).colorScheme).toBe('swap')
  })
  it('非数字概率不会污染成 NaN', () => {
    expect(
      resolveTiltTuning({ splitProbability: Number.NaN }).splitProbability
    ).toBe(DEFAULT_TILT_TUNING.splitProbability)
  })
})

describe('tilt 行数决策', () => {
  it('字数越多越倾向切得多', () => {
    const short = determineLineCount(3, 1, 1)
    const long = determineLineCount(60, 1, 1)
    expect(short).toBeLessThanOrEqual(long)
  })
  it('始终落在 1..4', () => {
    for (let chars = 0; chars <= 120; chars += 7)
      for (const seed of [0, 1.5, 7.25, 99])
        for (const probability of [0, 0.5, 1]) {
          const count = determineLineCount(chars, seed, probability)
          expect(count).toBeGreaterThanOrEqual(1)
          expect(count).toBeLessThanOrEqual(4)
        }
  })
  it('概率为 0 时只切 1 行', () => {
    expect(determineLineCount(200, 3, 0)).toBe(1)
  })
  it('同一种子结果稳定', () => {
    expect(determineLineCount(30, 4.5, 0.75)).toBe(
      determineLineCount(30, 4.5, 0.75)
    )
  })
})

describe('tilt 布局', () => {
  const line = makeLine(
    [
      word('在声音里', 0, 1),
      word('，', 1, 1.1),
      word('遇见另一片风景', 1.1, 3),
    ],
    '在声音里，遇见另一片风景'
  )
  const input = {
    fullText: line.fullText,
    lineSeed: line.startTime,
    tuning: DEFAULT_TILT_TUNING,
    theme,
    fontScale: 1,
    viewportWidth: 1200,
  }

  it('同一句反复构建得到相同结果', () => {
    expect(buildTiltLayout(input)).toEqual(buildTiltLayout(input))
  })
  it('段落拼接后不丢字', () => {
    const { segments } = buildTiltLayout(input)
    const joined = segments.map(segment => segment.text).join('')
    expect(joined.replace(/\s/g, '')).toBe(line.fullText.replace(/\s/g, ''))
  })
  it('整句最多一行斜体', () => {
    for (const seed of [0, 1, 2.5, 7, 13.75, 42]) {
      const { segments } = buildTiltLayout({ ...input, lineSeed: seed })
      expect(
        segments.filter(segment => segment.isTilt).length
      ).toBeLessThanOrEqual(1)
    }
  })
  it('斜体概率为 0 时没有斜体行', () => {
    const { segments } = buildTiltLayout({
      ...input,
      tuning: { ...DEFAULT_TILT_TUNING, tiltStyleProbability: 0 },
    })
    expect(segments.some(segment => segment.isTilt)).toBe(false)
  })
  it('纯省略号行不切分', () => {
    const { segments } = buildTiltLayout({ ...input, fullText: '……' })
    expect(segments).toHaveLength(1)
  })
  it('缩放倍率始终落在地板与 1 之间', () => {
    for (const viewportWidth of [320, 700, 1200, 2560])
      for (const seed of [0, 3, 11]) {
        const { scaleMultiplier } = buildTiltLayout({
          ...input,
          viewportWidth,
          lineSeed: seed,
        })
        expect(scaleMultiplier).toBeGreaterThanOrEqual(0.5)
        expect(scaleMultiplier).toBeLessThanOrEqual(1)
      }
  })
  it('段落最多 4 行', () => {
    const long =
      '把这一刻轻轻收藏让每一句都有自己的光音乐还在故事继续听见风也听见你'.repeat(
        3
      )
    const { segments } = buildTiltLayout({ ...input, fullText: long })
    expect(segments.length).toBeLessThanOrEqual(4)
  })
  it('charOffset 指向该段在整句中的真实位置', () => {
    const { segments } = buildTiltLayout(input)
    for (const segment of segments)
      if (segment.text)
        expect(line.fullText.slice(segment.charOffset)).toContain(
          segment.text.slice(0, 2)
        )
  })
})

describe('tilt 段落与字符时间', () => {
  const line = makeLine(
    [word('在声音里', 0, 1), word('遇见风景', 1, 3)],
    '在声音里遇见风景'
  )

  it('定位段落覆盖的词区间', () => {
    expect(
      findSegmentWordRange(0, '在声音里', line.fullText, line.words)
    ).toEqual({ startWordIndex: 0, endWordIndex: 1 })
    expect(
      findSegmentWordRange(4, '遇见风景', line.fullText, line.words)
    ).toEqual({ startWordIndex: 1, endWordIndex: 2 })
  })
  it('越界的偏移退回整句词区间', () => {
    expect(findSegmentWordRange(-1, 'x', line.fullText, line.words)).toEqual({
      startWordIndex: 0,
      endWordIndex: 2,
    })
    expect(findSegmentWordRange(999, 'x', line.fullText, line.words)).toEqual({
      startWordIndex: 0,
      endWordIndex: 2,
    })
  })
  it('字符时间覆盖所有非空白字素且单调递增', () => {
    const timings = buildTiltCharTimings(0, '在声音里', 0, 1, line)
    expect(timings).toHaveLength(4)
    for (let index = 1; index < timings.length; index += 1)
      expect(timings[index]!.startTime).toBeGreaterThanOrEqual(
        timings[index - 1]!.startTime
      )
  })
  it('空白不占时间槽位', () => {
    const spaced = makeLine([word('a b', 0, 1)], 'a b')
    const timings = buildTiltCharTimings(0, 'a b', 0, 1, spaced)
    expect(timings).toHaveLength(2)
  })
  it('没有行或空文本时返回空', () => {
    expect(buildTiltCharTimings(0, '在', 0, 1, null)).toEqual([])
    expect(buildTiltCharTimings(0, '', 0, 1, line)).toEqual([])
    expect(buildTiltCharTimings(0, '   ', 0, 1, line)).toEqual([])
  })
  it('段落按位置映射到词，数量对齐时用真实词时间', () => {
    // findSegmentWordRange 是按 charOffset + 长度定位的，不做文本匹配：
    // 只要字素数与映射到的词一致，就用词自己的时间，而不是段落区间均分。
    const timings = buildTiltCharTimings(0, '甲乙丙丁', 10, 14, line)
    expect(timings).toHaveLength(4)
    expect(timings[0]!.startTime).toBe(0)
    expect(timings[3]!.endTime).toBeCloseTo(1, 6)
  })
  it('字素数与词对不齐时整段均分，而不是留下错位的时间', () => {
    // 整句只有一个字，段落却有四个字素 —— 数量不匹配，必须回落到均分。
    const sparse = makeLine([word('在', 0, 1)], '在')
    const timings = buildTiltCharTimings(0, '甲乙丙丁', 10, 14, sparse)
    expect(timings).toHaveLength(4)
    expect(timings[0]!.startTime).toBe(10)
    expect(timings[3]!.endTime).toBeCloseTo(14, 6)
  })
  it('段落时间取该段覆盖的词', () => {
    const layout = buildTiltLayout({
      fullText: line.fullText,
      lineSeed: 0,
      tuning: { ...DEFAULT_TILT_TUNING, splitProbability: 1 },
      theme,
      fontScale: 1,
      viewportWidth: 1200,
    })
    const timings = buildTiltSegmentTimings(layout, line)
    expect(timings).toHaveLength(layout.segments.length)
    for (const timing of timings) {
      expect(timing.end).toBeGreaterThanOrEqual(timing.start)
      expect(Number.isFinite(timing.start)).toBe(true)
    }
  })
})

describe('tilt 逐帧求值', () => {
  const timing = { charIndex: 0, startTime: 1, endTime: 1.5 }

  it('唱到之前为 0', () => {
    expect(tiltCharPulse(0.9, timing)).toBe(0)
  })
  it('区间中段达到峰值 1', () => {
    // 时长 0.5 落在 0.2..0.9 的夹取区间内，所以峰值在 1.25 秒。
    expect(tiltCharPulse(1.25, timing)).toBeCloseTo(1, 6)
  })
  it('唱完后衰减到 0.25 的余晖', () => {
    expect(tiltCharPulse(5, timing)).toBe(0.25)
    const midway = tiltCharPulse(1.8, timing)
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(0.25)
  })
  it('极短与极长的词都被夹进 0.2..0.9 秒', () => {
    const tiny = { charIndex: 0, startTime: 0, endTime: 0.01 }
    expect(tiltCharPulse(0.1, tiny)).toBeCloseTo(1, 6)
    const huge = { charIndex: 0, startTime: 0, endTime: 100 }
    expect(tiltCharPulse(0.45, huge)).toBeCloseTo(1, 6)
  })
  it('强度始终落在 0..1', () => {
    for (let time = -1; time <= 6; time += 0.05) {
      const value = tiltCharPulse(time, timing)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
  it('缩放随强度增长，斜体行幅度更大', () => {
    expect(tiltCharScale(0, false)).toBe(1)
    expect(tiltCharScale(1, false)).toBeCloseTo(1.15, 6)
    expect(tiltCharScale(1, true)).toBeCloseTo(1.18, 6)
  })
})

describe('tilt 段落显现', () => {
  const line = makeLine(
    [word('a', 0, 1), word('b', 1, 2), word('c', 2, 3)],
    'abc'
  )
  const timings = [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
  ]

  it('整行开始前为 -1', () => {
    expect(tiltVisibleSegmentIndex(-0.5, timings, line)).toBe(-1)
  })
  it('按时间顺序累积显现', () => {
    expect(tiltVisibleSegmentIndex(0, timings, line)).toBe(0)
    expect(tiltVisibleSegmentIndex(1, timings, line)).toBe(1)
    expect(tiltVisibleSegmentIndex(2.5, timings, line)).toBe(2)
  })
  it('提前 0.25 秒开始显现，给入场留时间', () => {
    expect(tiltVisibleSegmentIndex(0.8, timings, line)).toBe(1)
  })
  it('整行结束后回到 -1', () => {
    expect(tiltVisibleSegmentIndex(99, timings, line)).toBe(-1)
  })
  it('没有行或没有段落时为 -1', () => {
    expect(tiltVisibleSegmentIndex(1, timings, null)).toBe(-1)
    expect(tiltVisibleSegmentIndex(1, [], line)).toBe(-1)
  })
})

describe('tilt 入场帧', () => {
  it('未显现时停在入场前的姿态，而不是残留在原处', () => {
    const normal = tiltSegmentFrame(99, 1, false, false)
    expect(normal).toEqual({ opacity: 0, translateY: 20, scale: 1 })
    const tilt = tiltSegmentFrame(99, 1, false, true)
    expect(tilt).toEqual({ opacity: 0, translateY: 24, scale: 0.92 })
  })
  it('入场提前量从段落开始时间往前算', () => {
    expect(tiltSegmentRevealStart(2)).toBeCloseTo(1.75, 6)
  })
  it('入场走完后归位', () => {
    const frame = tiltSegmentFrame(10, 1, true, true)
    expect(frame.opacity).toBe(1)
    expect(frame.translateY).toBe(0)
    expect(frame.scale).toBe(1)
  })
  it('入场过程中单调推进', () => {
    let previous = -1
    for (let time = 0.75; time <= 1.4; time += 0.05) {
      const frame = tiltSegmentFrame(time, 1, true, false)
      expect(frame.opacity).toBeGreaterThanOrEqual(previous)
      previous = frame.opacity
    }
  })
  it('字素按字序错开入场，斜体行间隔更大', () => {
    const base = {
      timeSec: 0.8,
      segmentStart: 1,
      visible: true,
      pulse: 0,
      staggerOffset: 6,
    }
    const first = tiltCharFrame({ ...base, charIndex: 0, isTilt: false })
    const fifth = tiltCharFrame({ ...base, charIndex: 5, isTilt: false })
    expect(first.opacity).toBeGreaterThan(fifth.opacity)
    // 同一字序下，斜体的间隔更大所以更晚。
    const normalLate = tiltCharFrame({ ...base, charIndex: 5, isTilt: false })
    const tiltLate = tiltCharFrame({ ...base, charIndex: 5, isTilt: true })
    expect(tiltLate.opacity).toBeLessThanOrEqual(normalLate.opacity)
  })
  it('斜体字素驻留在交替偏移上，入场从两倍偏移处来', () => {
    const hidden = tiltCharFrame({
      timeSec: 0,
      segmentStart: 1,
      charIndex: 0,
      visible: false,
      isTilt: true,
      pulse: 0,
      staggerOffset: -6,
    })
    expect(hidden.translateY).toBe(-12)
    const settled = tiltCharFrame({
      timeSec: 10,
      segmentStart: 1,
      charIndex: 0,
      visible: true,
      isTilt: true,
      pulse: 0,
      staggerOffset: -6,
    })
    expect(settled.translateY).toBeCloseTo(-6, 6)
  })
  it('正常行不做上下偏移', () => {
    const frame = tiltCharFrame({
      timeSec: 10,
      segmentStart: 1,
      charIndex: 0,
      visible: true,
      isTilt: false,
      pulse: 0,
      staggerOffset: 6,
    })
    expect(frame.translateY).toBe(0)
  })
  it('脉冲缩放叠加在入场之上', () => {
    const frame = tiltCharFrame({
      timeSec: 10,
      segmentStart: 1,
      charIndex: 0,
      visible: true,
      isTilt: false,
      pulse: 1,
      staggerOffset: 0,
    })
    expect(frame.scale).toBeCloseTo(1.15, 6)
  })
})

describe('tilt 配色与字素', () => {
  it('四种方案各自取色', () => {
    const accent = theme.accentColor
    expect(tiltColors(theme, 'default')).toEqual({
      normal: theme.primaryColor,
      tilt: accent,
    })
    expect(tiltColors(theme, 'swap')).toEqual({
      normal: accent,
      tilt: theme.primaryColor,
    })
    expect(tiltColors(theme, 'accentAll')).toEqual({
      normal: accent,
      tilt: accent,
    })
    expect(tiltColors(theme, 'primaryAll')).toEqual({
      normal: theme.primaryColor,
      tilt: theme.primaryColor,
    })
  })
  it('没有点缀色时退回主色，不会产出空串', () => {
    const plain = { ...theme, accentColor: '' }
    expect(tiltColors(plain, 'default').tilt).toBe(theme.primaryColor)
  })
  it('字素切分保留组合字符与 emoji', () => {
    expect(tiltGraphemes('a🌙b')).toEqual(['a', '🌙', 'b'])
    expect(tiltGraphemes('在声音里').join('')).toBe('在声音里')
  })
  it('种子随机落在 0..1 且稳定', () => {
    for (const seed of [0, 1.5, 99])
      for (const offset of [0, 7, 301]) {
        const value = seededRandom(seed, offset)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
        expect(seededRandom(seed, offset)).toBe(value)
      }
  })
})
