import { describe, expect, it } from 'vitest'
import type { Line } from '../../lyrics/folia/model'
import { FALLBACK_DUAL_THEME } from '../../theme/sanitize'
import type { Theme } from '../../theme/model'
import {
  claddaghAxisFrame,
  claddaghCharFrame,
  claddaghLengthMitigation,
  claddaghRadiusPulse,
  createPowerNormalizer,
  buildCladdaghGlowFilter,
  type CladdaghCharInput,
} from './claddaghFrame'
import {
  adjustCladdaghTimeline,
  buildCladdaghSpacing,
  buildCladdaghTimeline,
  claddaghFontSpec,
  claddaghLineRenderEnd,
  claddaghRadius,
  claddaghSpacingScale,
  CLADDAGH_MAX_ARC_SPAN,
  DEFAULT_CLADDAGH_TUNING,
  getFractionalActiveIndex,
  getLinePlaybackProgress,
  getLineWordOffset,
  getVisualLength,
  isCJKChar,
  measureCladdaghGraphemeOffsets,
  normalizeReadableAngle,
  resolveCladdaghTuning,
  shouldHoldCladdaghFrame,
} from './claddaghGeometry'

const theme: Theme = FALLBACK_DUAL_THEME.dark
const line = (
  startTime: number,
  endTime: number,
  fullText: string,
  extra: Partial<Line> = {}
): Line => ({
  words: [{ text: fullText, startTime, endTime }],
  startTime,
  endTime,
  fullText,
  ...extra,
})

describe('claddagh 调参', () => {
  it('缺省值与上游 DEFAULT_CLADDAGH_TUNING 一致', () => {
    expect(resolveCladdaghTuning()).toEqual(DEFAULT_CLADDAGH_TUNING)
    expect(DEFAULT_CLADDAGH_TUNING).toEqual({
      focusScaleRatio: 0.65,
      radiusScale: 1,
      ellipseTiltDeg: 45,
      showAxisLine: true,
      letterSpacingOffset: 0,
    })
  })
  it('各项都有限幅', () => {
    const extreme = resolveCladdaghTuning({
      focusScaleRatio: 99,
      radiusScale: 0.01,
      ellipseTiltDeg: 500,
      letterSpacingOffset: -999,
    })
    expect(extreme.focusScaleRatio).toBe(2)
    expect(extreme.radiusScale).toBe(0.4)
    expect(extreme.ellipseTiltDeg).toBe(90)
    expect(extreme.letterSpacingOffset).toBe(-20)
  })
  it('非数字退回缺省而不是 NaN', () => {
    expect(resolveCladdaghTuning({ radiusScale: Number.NaN }).radiusScale).toBe(
      1
    )
  })
})

describe('claddagh 文本度量', () => {
  it('CJK 记 1，半角记 0.5', () => {
    expect(isCJKChar('光')).toBe(true)
    expect(isCJKChar('a')).toBe(false)
    expect(getVisualLength('光')).toBe(1)
    expect(getVisualLength('ab')).toBe(1)
    expect(getVisualLength('')).toBe(0)
  })
  it('字素偏移单调不减', () => {
    const { fontSpec, fontPx } = claddaghFontSpec(theme, 1)
    const offsets = measureCladdaghGraphemeOffsets(
      ['在', '声', '音', '里'],
      fontSpec,
      fontPx
    )
    expect(offsets).toHaveLength(5)
    expect(offsets[0]).toBe(0)
    for (let index = 1; index < offsets.length; index += 1)
      expect(offsets[index]!).toBeGreaterThanOrEqual(offsets[index - 1]!)
  })
  it('额外字间距会把偏移推开', () => {
    const { fontSpec, fontPx } = claddaghFontSpec(theme, 1)
    const tight = measureCladdaghGraphemeOffsets(
      ['a', 'b', 'c'],
      fontSpec,
      fontPx,
      0
    )
    const loose = measureCladdaghGraphemeOffsets(
      ['a', 'b', 'c'],
      fontSpec,
      fontPx,
      20
    )
    expect(loose[3]!).toBeGreaterThan(tight[3]!)
  })
  it('半径与聚焦间距倍率', () => {
    expect(claddaghRadius(1000, 1).rx).toBe(440)
    // 宽屏下封顶 560。
    expect(claddaghRadius(4000, 1).rx).toBe(560)
    expect(claddaghRadius(1000, 1).ry).toBeCloseTo(440 * 0.707, 6)
    // 缺省聚焦比例下间距倍率为 1。
    expect(claddaghSpacingScale(DEFAULT_CLADDAGH_TUNING.focusScaleRatio)).toBe(
      1
    )
    expect(claddaghSpacingScale(1.3)).toBeGreaterThan(1)
  })
})

describe('claddagh 时间轴补齐', () => {
  it('零时长的间隙字符被摊成可见时长', () => {
    const adjusted = adjustCladdaghTimeline(
      [
        { startTime: 0, endTime: 1 },
        // 两个零时长的间隙。
        { startTime: 1, endTime: 1 },
        { startTime: 1, endTime: 1 },
        { startTime: 2, endTime: 3 },
      ],
      { startTime: 0, endTime: 3 }
    )
    expect(adjusted[1]!.endTime).toBeGreaterThan(adjusted[1]!.startTime)
    expect(adjusted[2]!.endTime).toBeGreaterThan(adjusted[2]!.startTime)
    // 间隙被填满且首尾相接。
    expect(adjusted[1]!.endTime).toBeCloseTo(adjusted[2]!.startTime, 6)
  })
  it('空间不足时从邻居借，但邻居不会被压到 40ms 以下', () => {
    const adjusted = adjustCladdaghTimeline(
      [
        { startTime: 0, endTime: 0.5 },
        { startTime: 0.5, endTime: 0.5 },
        { startTime: 0.5, endTime: 1 },
      ],
      { startTime: 0, endTime: 1 }
    )
    for (const item of adjusted)
      expect(item.endTime - item.startTime).toBeGreaterThanOrEqual(0.039)
  })
  it('首尾的间隙分别向行首行尾借时间', () => {
    const leading = adjustCladdaghTimeline(
      [
        { startTime: 1, endTime: 1 },
        { startTime: 1, endTime: 2 },
      ],
      { startTime: 0, endTime: 2 }
    )
    expect(leading[0]!.endTime).toBeGreaterThan(leading[0]!.startTime)
    const trailing = adjustCladdaghTimeline(
      [
        { startTime: 0, endTime: 1 },
        { startTime: 1, endTime: 1 },
      ],
      { startTime: 0, endTime: 2 }
    )
    expect(trailing[1]!.endTime).toBeGreaterThan(trailing[1]!.startTime)
  })
  it('没有零时长字符时原样返回', () => {
    const input = [
      { startTime: 0, endTime: 1 },
      { startTime: 1, endTime: 2 },
    ]
    expect(adjustCladdaghTimeline(input, { startTime: 0, endTime: 2 })).toEqual(
      input
    )
  })
  it('空时间轴不抛错', () => {
    expect(adjustCladdaghTimeline([], { startTime: 0, endTime: 1 })).toEqual([])
  })
  it('关键字着色按字符偏移落到对应字素上', () => {
    const timeline = buildCladdaghTimeline(line(0, 4, '在声音里遇见风景'), [
      { word: '风景', color: '#ff0000' },
    ])
    expect(timeline).toHaveLength(8)
    // '风' 与 '景' 命中区间，其余为 null。
    expect(timeline.map(item => item.charColor)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      '#ff0000',
      '#ff0000',
    ])
  })
  it('没有关键字时 charColor 全为 null，时序仍覆盖整行', () => {
    const timeline = buildCladdaghTimeline(line(1, 3, '光影'), [])
    expect(timeline.every(item => item.charColor === null)).toBe(true)
    expect(timeline[0]!.startTime).toBeCloseTo(1, 6)
    expect(timeline[timeline.length - 1]!.endTime).toBeCloseTo(3, 6)
  })
})

describe('claddagh 分数索引', () => {
  const timeline = [
    { startTime: 0, endTime: 1 },
    { startTime: 1, endTime: 2 },
    { startTime: 2, endTime: 3 },
  ]

  it('开始之前为 0', () => {
    expect(getFractionalActiveIndex(timeline, -1)).toBe(0)
    expect(getFractionalActiveIndex([], 5)).toBe(0)
  })
  it('字符之间线性插值', () => {
    expect(getFractionalActiveIndex(timeline, 0)).toBe(0)
    expect(getFractionalActiveIndex(timeline, 0.5)).toBeCloseTo(0.5, 6)
    expect(getFractionalActiveIndex(timeline, 1)).toBe(1)
  })
  it('越过末字继续外推，而不是卡住', () => {
    const beyond = getFractionalActiveIndex(timeline, 2.5)
    expect(beyond).toBeGreaterThan(2)
    // 没有 renderEnd 时最多外推 1.8 个字宽。
    expect(getFractionalActiveIndex(timeline, 99)).toBeCloseTo(2 + 1.8, 6)
  })
  it('有 renderEnd 时按它铺满剩余时间，最多再走两个字宽', () => {
    expect(getFractionalActiveIndex(timeline, 2, 4)).toBe(2)
    expect(getFractionalActiveIndex(timeline, 3, 4)).toBeCloseTo(3, 6)
    expect(getFractionalActiveIndex(timeline, 4, 4)).toBeCloseTo(4, 6)
    expect(getFractionalActiveIndex(timeline, 99, 4)).toBeCloseTo(4, 6)
  })
  it('单字时间轴按时长推进', () => {
    const single = [{ startTime: 1, endTime: 2 }]
    expect(getFractionalActiveIndex(single, 0)).toBe(0)
    expect(getFractionalActiveIndex(single, 1.5)).toBeCloseTo(0.5, 6)
  })
})

describe('claddagh 弧长分布', () => {
  const build = (text: string, radius = 440) => {
    const { fontSpec, fontPx } = claddaghFontSpec(theme, 1)
    const items = [...text].map((char, index) => ({
      char,
      startTime: index,
      endTime: index + 1,
      charColor: null,
    }))
    return buildCladdaghSpacing(items, fontSpec, fontPx, radius)
  }

  it('整句跨度以 0 为中心', () => {
    const spacing = build('在声音里遇见风景')
    const first = spacing[0]!.nominalAngle
    const last = spacing[spacing.length - 1]!.nominalAngle
    expect(first).toBeLessThan(0)
    expect(last).toBeGreaterThan(0)
    // 居中的是**整句跨度**，不是首末字的中心：首字中心在自身半宽处、
    // 末字中心在总宽减自身半宽处，所以两者之和只在首末字等宽时才为 0。
    // 有意义的性质是跨度中点离 0 不超过一个字的角宽。
    const span = last - first
    const charAngle = span / Math.max(1, spacing.length - 1)
    expect(Math.abs(first + last)).toBeLessThan(charAngle)
  })
  it('角度单调递增', () => {
    const spacing = build('在声音里遇见风景')
    for (let index = 1; index < spacing.length; index += 1)
      expect(spacing[index]!.nominalAngle).toBeGreaterThan(
        spacing[index - 1]!.nominalAngle
      )
  })
  it('超长句整体压缩到最大弧长以内', () => {
    const spacing = build('在声音里遇见另一片风景'.repeat(6))
    const span =
      spacing[spacing.length - 1]!.nominalAngle - spacing[0]!.nominalAngle
    expect(span).toBeLessThanOrEqual(CLADDAGH_MAX_ARC_SPAN + 1e-6)
    expect(spacing[0]!.scaleFactor).toBeLessThan(1)
  })
  it('短句不压缩', () => {
    expect(build('光').every(item => item.scaleFactor === 1)).toBe(true)
  })
  it('极窄半径也不会让角度爆炸', () => {
    const spacing = build('在声音里', 1)
    for (const item of spacing)
      expect(Number.isFinite(item.nominalAngle)).toBe(true)
  })
  it('空输入返回空', () => {
    const { fontSpec, fontPx } = claddaghFontSpec(theme, 1)
    expect(buildCladdaghSpacing([], fontSpec, fontPx, 440)).toEqual([])
  })
})

describe('claddagh 环旋转', () => {
  const spacing = [
    { nominalAngle: -1, startTime: 0, endTime: 1 },
    { nominalAngle: 0, startTime: 1, endTime: 2 },
    { nominalAngle: 1, startTime: 2, endTime: 3 },
  ]

  it('偏移量跟着当前字走', () => {
    expect(getLineWordOffset(spacing, 0)).toBeCloseTo(-1, 6)
    expect(getLineWordOffset(spacing, 1)).toBeCloseTo(0, 6)
    expect(getLineWordOffset(spacing, 2)).toBeCloseTo(1, 6)
  })
  it('越过末字按步长继续外推', () => {
    expect(getLineWordOffset(spacing, 99)).toBeGreaterThan(1)
  })
  it('播放进度落在 0..1', () => {
    expect(getLinePlaybackProgress(spacing, -1)).toBe(0)
    expect(getLinePlaybackProgress(spacing, 1)).toBeCloseTo(0.5, 6)
    expect(getLinePlaybackProgress(spacing, 99)).toBe(1)
    expect(getLinePlaybackProgress([], 5)).toBe(0)
  })
  it('渲染终点延到下一行入场之前，间奏期间环继续漂移', () => {
    const lines = [line(0, 2, 'a'), line(10, 12, 'b')]
    // 下一行 10 秒开始，提前 0.34 入场，所以终点是 9.66 而不是 2。
    expect(claddaghLineRenderEnd(lines, 0)).toBeCloseTo(9.66, 6)
    // 最后一行没有下一行，给 10 秒余量。
    expect(claddaghLineRenderEnd(lines, 1)).toBeCloseTo(22, 6)
    expect(claddaghLineRenderEnd(lines, 9)).toBeUndefined()
  })
  it('可读角度归一化到 -90..90', () => {
    expect(normalizeReadableAngle(0)).toBe(0)
    expect(normalizeReadableAngle(170)).toBe(-10)
    expect(normalizeReadableAngle(-170)).toBe(10)
    for (const degrees of [-540, -91, 91, 270, 721]) {
      const value = normalizeReadableAngle(degrees)
      expect(value).toBeGreaterThanOrEqual(-90)
      expect(value).toBeLessThanOrEqual(90)
    }
  })
  it('回拖到开头时保留已完成的那一帧', () => {
    // 时间源会在行索引更新之前归零，那一瞬间不能用旧行渲染。
    expect(shouldHoldCladdaghFrame(30, 0, 5)).toBe(true)
    expect(shouldHoldCladdaghFrame(30, 0, 0)).toBe(false)
    expect(shouldHoldCladdaghFrame(1, 0.9, 5)).toBe(false)
  })
})

describe('claddagh 音频响应', () => {
  it('能量归一化自动识别 0..255 与 0..1 两种量级', () => {
    const normalize = createPowerNormalizer()
    expect(normalize(0.5)).toBe(0.5)
    // 一旦见到 >1 就切到 255 量级，并对后续也生效。
    expect(normalize(255)).toBe(1)
    expect(normalize(128)).toBeCloseTo(128 / 255, 6)
    expect(normalize(Number.NaN)).toBe(0)
  })
  it('半径脉动按强度限幅', () => {
    expect(claddaghRadiusPulse('calm', 1)).toBeCloseTo(1.08, 6)
    expect(claddaghRadiusPulse('normal', 1)).toBeCloseTo(1.25, 6)
    expect(claddaghRadiusPulse('chaotic', 1)).toBeCloseTo(1.95, 6)
    expect(claddaghRadiusPulse('normal', 0)).toBe(1)
  })
  it('中轴线随能量改变颜色、长度与发光', () => {
    const quiet = claddaghAxisFrame(theme, 0, 0, 45, 0)
    const loud = claddaghAxisFrame(theme, 1, 1, 45, 1)
    expect(quiet.filter).toBe('none')
    expect(loud.filter).toContain('drop-shadow')
    // 低频平方放大长度。
    expect(loud.transform).toContain('scale(2.500')
    expect(quiet.transform).toContain('scale(1.000')
    expect(loud.background).toContain('linear-gradient')
  })
  it('主色与点缀色相同时退到次要色，保证节拍可见', () => {
    const flat: Theme = {
      ...theme,
      accentColor: theme.primaryColor,
      secondaryColor: '#123456',
    }
    expect(claddaghAxisFrame(flat, 1, 1, 45, 0).background).toContain(
      '18, 52, 86'
    )
  })
  it('长句缓解只对后续行生效', () => {
    expect(
      claddaghLengthMitigation('很长的一句歌词在这里', 'abc', 1, false)
    ).toEqual({ fade: 1, scale: 1 })
    const mitigated = claddaghLengthMitigation(
      '很长的一句歌词在这里需要缓解重叠',
      '下一句也不短',
      1,
      true
    )
    expect(mitigated.fade).toBeLessThan(1)
    expect(mitigated.scale).toBeLessThan(1)
  })
  it('短句不触发缓解', () => {
    expect(claddaghLengthMitigation('短', 'abc', 1, true)).toEqual({
      fade: 1,
      scale: 1,
    })
  })
})

describe('claddagh 发光 filter', () => {
  it('用 drop-shadow 而不是 text-shadow —— 规避字形缓存泄漏', () => {
    const filter = buildCladdaghGlowFilter(
      '#e8c879',
      '#ffffff',
      24,
      1,
      1,
      false
    )
    expect(filter).toContain('drop-shadow(')
    expect(filter).not.toContain('text-shadow')
    // 单层按半径的一半。
    expect(filter).toContain('12.00px')
  })
  it('副歌用三层，中间层明显更弱', () => {
    const filter = buildCladdaghGlowFilter('#e8c879', '#ffffff', 40, 1, 1, true)
    expect(filter.match(/drop-shadow\(/g)).toHaveLength(3)
    // 0.4 倍系数：0.35/1/1.6 → 5.6 / 16 / 25.6
    expect(filter).toContain('5.60px')
    expect(filter).toContain('16.00px')
    expect(filter).toContain('25.60px')
    expect(filter).toContain('0.2)')
  })
})

describe('claddagh 逐字投影', () => {
  const spacing = buildCladdaghSpacing(
    [...'在声音里遇见风景'].map((char, index) => ({
      char,
      startTime: index * 0.5,
      endTime: index * 0.5 + 0.5,
      charColor: null,
    })),
    claddaghFontSpec(theme, 1).fontSpec,
    claddaghFontSpec(theme, 1).fontPx,
    440
  )
  const base = (
    overrides: Partial<CladdaghCharInput> = {}
  ): CladdaghCharInput => ({
    item: spacing[4]!,
    charIndex: 4,
    timeSec: 2,
    lineOffset: 0,
    wordOffset: 0,
    lineIndex: 0,
    centerLineIndex: 0,
    rx: 440,
    ry: 311,
    fontPx: 72,
    theme,
    tiltDeg: 45,
    focusScaleRatio: 0.65,
    power: 0,
    isChorus: false,
    upcomingEntry: 1,
    lengthFade: 1,
    lengthScale: 1,
    baseColor: 'rgba(242, 242, 234, 0.55)',
    highlightColor: theme.accentColor,
    ...overrides,
  })

  it('透明度始终落在 0..1，变换与 filter 都有限', () => {
    for (const lineIndex of [0, 1, 2])
      for (let time = -1; time <= 6; time += 0.25)
        for (const item of spacing) {
          const frame = claddaghCharFrame(
            base({ item, timeSec: time, lineIndex, charIndex: 0 })
          )
          expect(frame.opacity).toBeGreaterThanOrEqual(0)
          expect(frame.opacity).toBeLessThanOrEqual(1)
          expect(frame.transform).not.toContain('NaN')
          expect(frame.filter).not.toContain('NaN')
        }
  })
  it('正前方的字最大最清晰', () => {
    // nominalAngle 为 0 附近的字转到正面时 scale 最大、无模糊。
    const centered = spacing.reduce((best, item) =>
      Math.abs(item.nominalAngle) < Math.abs(best.nominalAngle) ? item : best
    )
    const front = claddaghCharFrame(
      base({ item: centered, lineOffset: centered.nominalAngle })
    )
    const back = claddaghCharFrame(
      base({ item: centered, lineOffset: centered.nominalAngle + Math.PI })
    )
    const frontScale = Number(front.transform.match(/scale\(([\d.]+)\)/)![1])
    const backScale = Number(back.transform.match(/scale\(([\d.]+)\)/)![1])
    expect(frontScale).toBeGreaterThan(backScale)
    expect(front.filter).not.toContain('blur')
    expect(back.filter).toContain('blur')
  })
  it('唱过的字切到高亮色', () => {
    const item = spacing[0]!
    const before = claddaghCharFrame(
      base({ item, timeSec: item.startTime - 1 })
    )
    const after = claddaghCharFrame(base({ item, timeSec: item.endTime + 1 }))
    expect(after.color).toBe(theme.accentColor)
    expect(before.color).not.toBe(theme.accentColor)
  })
  it('关键字着色优先于主题点缀色', () => {
    const colored = { ...spacing[0]!, charColor: '#ff0000' }
    const frame = claddaghCharFrame(
      base({ item: colored, timeSec: colored.endTime + 1 })
    )
    expect(frame.color).toBe('#ff0000')
  })
  it('已过去的行在转场完成后完全隐藏', () => {
    const frame = claddaghCharFrame(
      base({ lineIndex: 0, centerLineIndex: 1, lineOffset: Math.PI })
    )
    expect(frame.opacity).toBeCloseTo(0, 6)
  })
  it('后续行按入场进度淡入', () => {
    const early = claddaghCharFrame(
      base({ lineIndex: 1, centerLineIndex: 0, upcomingEntry: 0 })
    )
    const late = claddaghCharFrame(
      base({ lineIndex: 1, centerLineIndex: 0, upcomingEntry: 1 })
    )
    expect(late.opacity).toBeGreaterThan(early.opacity)
  })
  it('副歌给奇偶字上下交错', () => {
    const even = claddaghCharFrame(base({ charIndex: 0, isChorus: true }))
    const odd = claddaghCharFrame(base({ charIndex: 1, isChorus: true }))
    expect(even.transform).not.toBe(odd.transform)
  })
  it('倾角改变投影方向', () => {
    const tilted = claddaghCharFrame(base({ tiltDeg: 0 }))
    const diagonal = claddaghCharFrame(base({ tiltDeg: 45 }))
    expect(tilted.transform).not.toBe(diagonal.transform)
  })
})
