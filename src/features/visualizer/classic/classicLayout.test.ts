import { describe, expect, it } from 'vitest'
import type { Line, Word } from '../../lyrics/folia/model'
import { FALLBACK_DUAL_THEME } from '../../theme/sanitize'
import type { Theme } from '../../theme/model'
import {
  buildClassicLayout,
  classicBreathing,
  classicPixelFontSize,
  classicWordStatus,
  DEFAULT_CLASSIC_TUNING,
  getClassicWordActiveEndTime,
  getClassicWordDisplayDuration,
  resolveClassicLineRenderProfile,
  resolveClassicTuning,
  type ClassicLineRenderProfile,
} from './classicLayout'

const word = (startTime: number, endTime: number, text = 'a'): Word => ({
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

const theme = (intensity: Theme['animationIntensity'] = 'normal'): Theme => ({
  ...FALLBACK_DUAL_THEME.dark,
  animationIntensity: intensity,
})

const profile = (
  overrides: Partial<ClassicLineRenderProfile> = {}
): ClassicLineRenderProfile => ({
  renderHints: null,
  lineRenderEndTime: 10,
  lineTransitionMode: 'normal',
  wordRevealMode: 'normal',
  wordLookahead: 0.15,
  ...overrides,
})

describe('classic 调参', () => {
  it('缺省值与上游 DEFAULT_CLASSIC_TUNING 一致', () => {
    expect(resolveClassicTuning()).toEqual(DEFAULT_CLASSIC_TUNING)
    expect(DEFAULT_CLASSIC_TUNING).toEqual({
      enableWordRotation: true,
      breathingFloatMultiplier: 1,
      useLegacyLayout: false,
      wordSpacing: 0.7,
    })
  })
  it('呼吸倍率与词距都限幅在 0..2', () => {
    expect(
      resolveClassicTuning({ breathingFloatMultiplier: 9 })
        .breathingFloatMultiplier
    ).toBe(2)
    expect(
      resolveClassicTuning({ breathingFloatMultiplier: -3 })
        .breathingFloatMultiplier
    ).toBe(0)
    expect(resolveClassicTuning({ wordSpacing: 5 }).wordSpacing).toBe(2)
    expect(resolveClassicTuning({ wordSpacing: -1 }).wordSpacing).toBe(0)
  })
})

describe('classic 行时序档案', () => {
  it('没有行时返回 null', () => {
    expect(resolveClassicLineRenderProfile(null)).toBeNull()
    expect(resolveClassicLineRenderProfile(undefined)).toBeNull()
  })
  it('前瞻时间随 wordRevealMode 收紧', () => {
    expect(profile({ wordRevealMode: 'normal' }).wordLookahead).toBe(0.15)
    // 真实档案由 renderHints 决定，这里验证映射表本身。
    const normal = resolveClassicLineRenderProfile(
      makeLine([word(0, 2, '一句比较长的歌词')])
    )
    expect(normal).not.toBeNull()
    expect([0.03, 0.08, 0.15]).toContain(normal!.wordLookahead)
  })
})

describe('classic 词的活跃区间', () => {
  it('instant 模式整行都算活跃', () => {
    const current = profile({ wordRevealMode: 'instant', lineRenderEndTime: 7 })
    expect(getClassicWordActiveEndTime(word(1, 2), current)).toBe(7)
  })
  it('fast 模式至少给 0.12 秒，但不越过行末', () => {
    const current = profile({ wordRevealMode: 'fast', lineRenderEndTime: 7 })
    // 词本身只有 0.02 秒，抬到 0.12。
    expect(getClassicWordActiveEndTime(word(1, 1.02), current)).toBeCloseTo(
      1.12,
      6
    )
    // 行末更早时以行末为准。
    const tight = profile({ wordRevealMode: 'fast', lineRenderEndTime: 1.05 })
    expect(getClassicWordActiveEndTime(word(1, 1.02), tight)).toBeCloseTo(
      1.05,
      6
    )
  })
  it('normal 模式用词自己的结束时间', () => {
    expect(getClassicWordActiveEndTime(word(1, 2.5), profile())).toBe(2.5)
  })
  it('显示时长有按模式区分的下限', () => {
    expect(
      getClassicWordDisplayDuration(
        word(1, 1.001),
        profile({ wordRevealMode: 'instant', lineRenderEndTime: 1.001 })
      )
    ).toBe(0.08)
    expect(
      getClassicWordDisplayDuration(
        word(1, 1.001),
        profile({ wordRevealMode: 'normal' })
      )
    ).toBe(0.1)
  })
})

describe('classic 词状态', () => {
  const current = profile({ wordRevealMode: 'normal', lineRenderEndTime: 10 })
  const target = word(2, 3)

  it('前瞻窗口内就提前进入 active', () => {
    expect(classicWordStatus(1.9, target, current)).toBe('active')
    expect(classicWordStatus(1.84, target, current)).toBe('waiting')
  })
  it('区间内 active，越过结束时间转 passed', () => {
    expect(classicWordStatus(2.5, target, current)).toBe('active')
    expect(classicWordStatus(3, target, current)).toBe('active')
    expect(classicWordStatus(3.01, target, current)).toBe('passed')
  })
  it('instant 模式下整行内都保持 active', () => {
    const instant = profile({
      wordRevealMode: 'instant',
      lineRenderEndTime: 10,
      wordLookahead: 0.03,
    })
    expect(classicWordStatus(9.5, target, instant)).toBe('active')
    expect(classicWordStatus(10.5, target, instant)).toBe('passed')
  })
})

describe('classic 布局', () => {
  const words = [word(0, 1, '光'), word(1, 2, '的'), word(2, 3, '回声')]
  const line = makeLine(words)

  it('同一行反复构建得到完全相同的几何 —— 时间只改状态，不改布局', () => {
    const input = {
      line,
      words,
      theme: theme(),
      tuning: DEFAULT_CLASSIC_TUNING,
      lyricsFontScale: 1,
      viewportWidth: 1200,
    }
    expect(buildClassicLayout(input)).toEqual(buildClassicLayout(input))
  })

  it('不同起始时间的行得到不同构图', () => {
    const other = makeLine([
      word(9, 10, '光'),
      word(10, 11, '的'),
      word(11, 12, '回声'),
    ])
    const base = {
      words,
      theme: theme(),
      tuning: DEFAULT_CLASSIC_TUNING,
      lyricsFontScale: 1,
      viewportWidth: 1200,
    }
    expect(buildClassicLayout({ ...base, line }).wordConfigs).not.toEqual(
      buildClassicLayout({ ...base, line: other, words: other.words })
        .wordConfigs
    )
  })

  it('calm 强度下不散开、不旋转、整行居中', () => {
    const { lineConfig, wordConfigs } = buildClassicLayout({
      line,
      words,
      theme: theme('calm'),
      tuning: DEFAULT_CLASSIC_TUNING,
      lyricsFontScale: 1,
      viewportWidth: 1200,
    })
    expect(lineConfig.justifyContent).toBe('center')
    expect(lineConfig.alignItems).toBe('center')
    expect(lineConfig.perspective).toBe(1000)
    for (const config of wordConfigs) {
      // 用 toBeCloseTo：幅度为 0 时乘法会按随机值的符号产出 -0，
      // 它在 CSS 与算术里都等同于 0，只有 Object.is 会区分。
      expect(config.x).toBeCloseTo(0, 10)
      expect(config.y).toBeCloseTo(0, 10)
      expect(config.rotate).toBeCloseTo(0, 10)
    }
  })

  it('关闭词旋转时 rotate 与 passedRotate 都归零', () => {
    const { wordConfigs } = buildClassicLayout({
      line,
      words,
      theme: theme('chaotic'),
      tuning: { ...DEFAULT_CLASSIC_TUNING, enableWordRotation: false },
      lyricsFontScale: 1,
      viewportWidth: 1200,
    })
    for (const config of wordConfigs) {
      expect(config.rotate).toBeCloseTo(0, 10)
      expect(config.passedRotate).toBeCloseTo(0, 10)
    }
  })

  it('间奏行居中、放大且不旋转', () => {
    const interlude = makeLine([word(0, 4, '......')], '......')
    const { lineConfig, wordConfigs } = buildClassicLayout({
      line: interlude,
      words: interlude.words,
      theme: theme('chaotic'),
      tuning: DEFAULT_CLASSIC_TUNING,
      lyricsFontScale: 1,
      viewportWidth: 1200,
    })
    expect(lineConfig.justifyContent).toBe('center')
    expect(wordConfigs[0]!.scale).toBe(1.5)
    expect(wordConfigs[0]!.rotate).toBe(0)
    expect(wordConfigs[0]!.marginRight).toBe('3rem')
  })

  it('新排版算出像素右边距；legacy 排版用固定值', () => {
    const base = {
      line,
      words,
      theme: theme(),
      lyricsFontScale: 1,
      viewportWidth: 1200,
    }
    const modern = buildClassicLayout({
      ...base,
      tuning: DEFAULT_CLASSIC_TUNING,
    })
    expect(modern.wordConfigs[0]!.marginRight).toMatch(/px$/)
    const legacy = buildClassicLayout({
      ...base,
      tuning: { ...DEFAULT_CLASSIC_TUNING, useLegacyLayout: true },
    })
    expect(legacy.wordConfigs[0]!.marginRight).toBe('0.8rem')
  })

  it('词距倍率为 0 时右边距塌到 0', () => {
    const { wordConfigs } = buildClassicLayout({
      line,
      words,
      theme: theme(),
      tuning: { ...DEFAULT_CLASSIC_TUNING, wordSpacing: 0 },
      lyricsFontScale: 1,
      viewportWidth: 1200,
    })
    expect(Number.parseFloat(wordConfigs[0]!.marginRight)).toBe(0)
  })

  it('词数为 0 时不抛错', () => {
    expect(
      buildClassicLayout({
        line: makeLine([]),
        words: [],
        theme: theme(),
        tuning: DEFAULT_CLASSIC_TUNING,
        lyricsFontScale: 1,
        viewportWidth: 1200,
      }).wordConfigs
    ).toEqual([])
  })
})

describe('classic 字号与呼吸', () => {
  it('字号按 clamp(2.25rem, 6vw, 4.5rem) 换算', () => {
    expect(classicPixelFontSize(1, 300)).toBe(36)
    expect(classicPixelFontSize(1, 1200)).toBe(72)
    expect(classicPixelFontSize(1, 3000)).toBe(72)
  })
  it('倍率为 0 时关闭呼吸', () => {
    expect(
      classicBreathing(
        { ...DEFAULT_CLASSIC_TUNING, breathingFloatMultiplier: 0 },
        'normal'
      )
    ).toBeNull()
  })
  it('呼吸幅度随强度与倍率变化', () => {
    expect(classicBreathing(DEFAULT_CLASSIC_TUNING, 'calm')).toEqual({
      distancePx: 10,
      durationSec: 8.5,
      scaleAmount: 0.01,
    })
    expect(classicBreathing(DEFAULT_CLASSIC_TUNING, 'chaotic')).toEqual({
      distancePx: 18,
      durationSec: 5.8,
      scaleAmount: 0.01,
    })
    expect(
      classicBreathing(
        { ...DEFAULT_CLASSIC_TUNING, breathingFloatMultiplier: 2 },
        'normal'
      )
    ).toEqual({ distancePx: 28, durationSec: 7, scaleAmount: 0.02 })
  })
})
