import { describe, expect, it } from 'vitest'
import type { Line, Word } from '../../lyrics/folia/model'
import { FALLBACK_DUAL_THEME } from '../../theme/sanitize'
import type { Theme } from '../../theme/model'
import {
  buildCadenzaEmphasisMap,
  buildCadenzaPlacements,
  chooseCadenzaFontPx,
  DEFAULT_CADENZA_TUNING,
  findCadenzaWordRanges,
  prepareCadenzaLine,
  resolveCadenzaTuning,
  type CadenzaLineView,
  type CadenzaWordFragment,
} from './cadenzaLayout'
import {
  cadenzaBodyMix,
  cadenzaCharGlow,
  cadenzaGlowEnvelope,
  cadenzaKeyframedGlow,
  cadenzaLineEnvelope,
  cadenzaPassedDrift,
  cadenzaWordProgress,
  cadenzaWordStatus,
  resolveCadenzaLineTiming,
} from './cadenzaTiming'
import {
  cadenzaGlowFilter,
  cadenzaGraphemeGlow,
  cadenzaPlacementTarget,
  cadenzaRipple,
  followCadenzaState,
  initialCadenzaState,
  isCadenzaSeek,
  snapCadenzaState,
  type CadenzaTargetInput,
} from './cadenzaFrame'

const theme: Theme = FALLBACK_DUAL_THEME.dark

const word = (text: string, startTime: number, endTime: number): Word => ({
  text,
  startTime,
  endTime,
})

const line = (words: Word[], extra: Partial<Line> = {}): Line => ({
  words,
  startTime: words[0]?.startTime ?? 0,
  endTime: words[words.length - 1]?.endTime ?? 1,
  fullText: words.map(item => item.text).join(''),
  ...extra,
})

describe('cadenza 调参', () => {
  it('缺省值与上游一致', () => {
    expect(resolveCadenzaTuning()).toEqual(DEFAULT_CADENZA_TUNING)
    expect(DEFAULT_CADENZA_TUNING).toEqual({
      fontScale: 1.12,
      widthRatio: 0.72,
      motionAmount: 1,
      glowIntensity: 1,
    })
  })
  it('各项都有限幅，非数字退回缺省', () => {
    const extreme = resolveCadenzaTuning({
      fontScale: 99,
      widthRatio: 0,
      motionAmount: -5,
      glowIntensity: Number.NaN,
    })
    expect(extreme.fontScale).toBe(2)
    expect(extreme.widthRatio).toBe(0.3)
    expect(extreme.motionAmount).toBe(0)
    expect(extreme.glowIntensity).toBe(1)
  })
})

describe('cadenza 字号选择', () => {
  it('按舞台宽度定基准并限幅', () => {
    const short = line([word('光', 0, 1)])
    expect(chooseCadenzaFontPx(1000, short)).toBeCloseTo(86, 6)
    // 窄屏下地板 34（基准下限），宽屏下天花板 94。
    expect(chooseCadenzaFontPx(100, short)).toBe(34)
    expect(chooseCadenzaFontPx(5000, short)).toBe(94)
  })
  it('长句与多词各自扣减字号', () => {
    const base = line([word('在声音里遇见', 0, 1)])
    const long = line([word('在声音里遇见另一片更远的风景吧', 0, 1)])
    expect(chooseCadenzaFontPx(1000, long)).toBeLessThan(
      chooseCadenzaFontPx(1000, base)
    )
    const dense = line(
      Array.from({ length: 12 }, (_unused, index) =>
        word('a', index, index + 1)
      )
    )
    expect(chooseCadenzaFontPx(1000, dense)).toBeLessThan(
      chooseCadenzaFontPx(1000, base)
    )
  })
  it('扣减后仍不低于 28', () => {
    const huge = line([word('词'.repeat(200), 0, 1)])
    expect(chooseCadenzaFontPx(400, huge)).toBe(28)
  })
})

describe('cadenza 词→字素映射', () => {
  it('按字素流定位每个词，区间首尾相接', () => {
    const target = line([
      word('在声音里', 0, 1),
      word('遇见', 1, 2),
      word('风景', 2, 3),
    ])
    const graphemes = [...'在声音里遇见风景']
    const ranges = findCadenzaWordRanges(target, graphemes, theme)
    expect(ranges.map(range => [range.start, range.end])).toEqual([
      [0, 4],
      [4, 6],
      [6, 8],
    ])
  })
  it('重复词不会都匹配到第一处', () => {
    const target = line([word('光', 0, 1), word('影', 1, 2), word('光', 2, 3)])
    const ranges = findCadenzaWordRanges(target, [...'光影光'], theme)
    expect(ranges[0]!.start).toBe(0)
    expect(ranges[2]!.start).toBe(2)
  })
  it('字素流里找不到该词时退回游标处，不越界也不重叠', () => {
    const target = line([word('甲', 0, 1), word('乙丙', 1, 2)])
    // 字素流与 words 完全不匹配（上游 fullText 与 words 不保证可简单拼接）。
    const ranges = findCadenzaWordRanges(target, [...'xy'], theme)
    expect(ranges[0]!.start).toBe(0)
    expect(ranges[0]!.end).toBeLessThanOrEqual(2)
    expect(ranges[1]!.start).toBeGreaterThanOrEqual(ranges[0]!.end)
    expect(ranges[1]!.end).toBeLessThanOrEqual(2)
  })
  it('每个词都带字素时序与高亮色', () => {
    const target = line([word('遇见', 0, 1)])
    const ranges = findCadenzaWordRanges(target, [...'遇见'], theme)
    expect(ranges[0]!.graphemeTimings).toHaveLength(2)
    expect(ranges[0]!.color).toBe(theme.accentColor)
  })
})

describe('cadenza 主角词', () => {
  const fragment = (
    overrides: Partial<CadenzaWordFragment> = {}
  ): CadenzaWordFragment => ({
    wordIndex: 0,
    lineIndex: 0,
    word: word('遇见', 0, 1),
    text: '遇见',
    color: '#ffffff',
    startX: 0,
    endX: 100,
    fragmentStartInWord: 0,
    wordGraphemeCount: 2,
    wordGraphemeTimings: [],
    fragmentIndexInWord: 0,
    isPrimaryFragment: true,
    isSplitAcrossLines: false,
    ...overrides,
  })
  const view = (fragments: CadenzaWordFragment[]): CadenzaLineView => ({
    line: {
      text: '',
      width: 400,
      start: { segmentIndex: 0, graphemeIndex: 0 },
      end: { segmentIndex: 0, graphemeIndex: 0 },
    },
    lineStart: 0,
    lineEnd: 0,
    fragments,
  })

  it('只选出一个主角并放大', () => {
    const map = buildCadenzaEmphasisMap(
      [
        view([
          fragment({ wordIndex: 0 }),
          fragment({ wordIndex: 1 }),
          fragment({ wordIndex: 2 }),
        ]),
      ],
      false
    )
    expect(map.size).toBe(1)
    expect([...map.values()][0]!).toBeGreaterThan(1.4)
  })
  it('被换行切开的词不参选 —— 否则它的片段会叠在一起', () => {
    const map = buildCadenzaEmphasisMap(
      [
        view([
          fragment({ wordIndex: 0, isSplitAcrossLines: true }),
          fragment({ wordIndex: 1, text: '风景', isSplitAcrossLines: false }),
        ]),
      ],
      false
    )
    expect([...map.keys()]).toEqual([1])
  })
  it('纯空白片段不参选', () => {
    const map = buildCadenzaEmphasisMap(
      [view([fragment({ wordIndex: 0, text: '   ' })])],
      false
    )
    expect(map.size).toBe(0)
  })
  it('间奏行没有主角', () => {
    expect(buildCadenzaEmphasisMap([view([fragment()])], true).size).toBe(0)
  })
})

describe('cadenza placement 碰撞回避', () => {
  const buildViews = (count: number, widthEach = 120): CadenzaLineView[] => [
    {
      line: {
        text: '',
        width: widthEach * count,
        start: { segmentIndex: 0, graphemeIndex: 0 },
        end: { segmentIndex: 0, graphemeIndex: 0 },
      },
      lineStart: 0,
      lineEnd: count * 2,
      fragments: Array.from({ length: count }, (_unused, index) => ({
        wordIndex: index,
        lineIndex: 0,
        word: word(`w${index}`, index, index + 1),
        text: `w${index}`,
        color: '#ffffff',
        startX: index * widthEach,
        endX: (index + 1) * widthEach,
        fragmentStartInWord: 0,
        wordGraphemeCount: 2,
        wordGraphemeTimings: [],
        fragmentIndexInWord: 0,
        isPrimaryFragment: true,
        isSplitAcrossLines: false,
      })),
    },
  ]

  const place = (count: number) =>
    buildCadenzaPlacements(
      buildViews(count),
      72,
      88,
      800,
      'normal',
      1000,
      false,
      true
    )

  it('每个片段都有一个 placement，几何均为有限值', () => {
    const placements = place(5)
    expect(placements).toHaveLength(5)
    for (const placement of placements) {
      expect(Number.isFinite(placement.x)).toBe(true)
      expect(Number.isFinite(placement.y)).toBe(true)
      expect(placement.width).toBeGreaterThan(0)
      expect(placement.height).toBeGreaterThan(0)
    }
  })
  it('放置后的矩形互不重叠', () => {
    const placements = place(6)
    // placement 的 (x, y) 是左端 + 基线，矩形向上展开 height。
    const rects = placements.map(item => ({
      left: item.x,
      right: item.x + item.width * item.scale,
      top: item.y - item.height,
      bottom: item.y,
    }))
    for (let a = 0; a < rects.length; a += 1)
      for (let b = a + 1; b < rects.length; b += 1) {
        const overlapWidth =
          Math.min(rects[a]!.right, rects[b]!.right) -
          Math.max(rects[a]!.left, rects[b]!.left)
        const overlapHeight =
          Math.min(rects[a]!.bottom, rects[b]!.bottom) -
          Math.max(rects[a]!.top, rects[b]!.top)
        expect(Math.min(overlapWidth, overlapHeight)).toBeLessThanOrEqual(0)
      }
  })
  it('同样的输入产出同样的布局 —— 种子来自行起始时刻', () => {
    expect(place(4)).toEqual(place(4))
  })
  it('主角词被放到中心附近并显著放大', () => {
    const placements = place(5)
    const hero = placements.reduce((best, item) =>
      item.emphasis > best.emphasis ? item : best
    )
    expect(hero.emphasis).toBeGreaterThan(1.4)
    expect(hero.scale).toBeGreaterThan(1.4)
    // 主角的理想位置是 x 居中（-width/2），搜索半径上限只有 lineHeight*0.5。
    expect(Math.abs(hero.x + hero.width / 2)).toBeLessThan(88)
  })
  it('片段被塞满时退回重叠最小的候选，而不是丢弃', () => {
    // 20 个宽片段必然放不下，但每个都要有位置。
    expect(place(20)).toHaveLength(20)
  })
  it('间奏行不选主角，所有片段同一基准缩放', () => {
    const placements = buildCadenzaPlacements(
      buildViews(4),
      72,
      88,
      800,
      'normal',
      1000,
      true,
      true
    )
    expect(new Set(placements.map(item => item.emphasis))).toEqual(new Set([1]))
  })
  it('逐字发光只在多字素的非 CJK 片段上开启', () => {
    const [latin] = buildCadenzaPlacements(
      buildViews(1),
      72,
      88,
      800,
      'normal',
      1000,
      false,
      true
    )
    expect(latin!.splitGlow).toBe(true)
    // splitGlow 开关关闭时（fast/instant 模式）一律整词发光。
    const [off] = buildCadenzaPlacements(
      buildViews(1),
      72,
      88,
      800,
      'normal',
      1000,
      false,
      false
    )
    expect(off!.splitGlow).toBe(false)
  })
  it('chaotic 比 calm 漂得更远', () => {
    const drift = (intensity: Theme['animationIntensity']) =>
      buildCadenzaPlacements(
        buildViews(3),
        72,
        88,
        800,
        intensity,
        1000,
        false,
        true
      ).reduce(
        (sum, item) => sum + Math.hypot(item.passedDriftX, item.passedDriftY),
        0
      )
    expect(drift('chaotic')).toBeGreaterThan(drift('calm'))
  })
})

describe('cadenza 整行排版', () => {
  const target = line([
    word('在声音里', 0, 1),
    word('遇见', 1, 2),
    word('风景', 2, 3),
  ])
  const context = {
    stageWidth: 1200,
    stageHeight: 700,
    theme,
    fontScale: 1,
    widthRatio: 0.72,
  }

  it('舞台尺寸为 0 时不排版', () => {
    expect(prepareCadenzaLine(target, { ...context, stageWidth: 0 })).toBeNull()
    expect(
      prepareCadenzaLine(target, { ...context, stageHeight: 0 })
    ).toBeNull()
  })
  it('拿不到文本测量时返回 null，而不是抛错', () => {
    // pretext 需要 OffscreenCanvas 或 DOM canvas；vitest 跑在 node 环境下没有。
    // 浏览器里这条路不会触发，但渲染组件必须能处理 null —— 这里把这个契约固定住。
    expect(prepareCadenzaLine(target, context)).toBeNull()
  })
})

describe('cadenza 时序包络', () => {
  const target = line([word('遇见', 1, 2), word('风景', 2, 3)])
  const timing = resolveCadenzaLineTiming(target)

  it('三态按预读窗口切换', () => {
    const first = target.words[0]!
    // normal 模式预读 0.18 秒。
    expect(cadenzaWordStatus(0.9, timing, first)).toBe('active')
    expect(cadenzaWordStatus(0.7, timing, first)).toBe('waiting')
    expect(cadenzaWordStatus(1.5, timing, first)).toBe('active')
    expect(cadenzaWordStatus(2.5, timing, first)).toBe('passed')
  })
  it('instant 模式整行一起活跃到渲染终点', () => {
    const instant = line([word('a', 1, 1.05), word('b', 1.05, 1.1)], {
      renderHints: {
        rawDuration: 0.1,
        timingClass: 'micro',
        renderEndTime: 1.5,
        lineTransitionMode: 'fast',
        wordRevealMode: 'instant',
      },
    })
    const instantTiming = resolveCadenzaLineTiming(instant)
    expect(cadenzaWordStatus(1.4, instantTiming, instant.words[0]!)).toBe(
      'active'
    )
    expect(cadenzaWordStatus(1.6, instantTiming, instant.words[0]!)).toBe(
      'passed'
    )
  })
  it('进度与正文混色落在 0..1', () => {
    const first = target.words[0]!
    expect(cadenzaWordProgress(0.5, 'normal', first)).toBe(0)
    expect(cadenzaWordProgress(1.5, 'normal', first)).toBeCloseTo(0.5, 6)
    expect(cadenzaWordProgress(9, 'normal', first)).toBe(1)
    for (let time = 0; time <= 5; time += 0.1) {
      const mixAmount = cadenzaBodyMix(time, timing, first)
      expect(mixAmount).toBeGreaterThanOrEqual(0)
      expect(mixAmount).toBeLessThanOrEqual(1)
    }
  })
  it('关键帧发光在 30% 处达峰，两端为 0', () => {
    expect(cadenzaKeyframedGlow(0)).toBe(0)
    expect(cadenzaKeyframedGlow(1)).toBe(0)
    expect(cadenzaKeyframedGlow(0.3)).toBeCloseTo(1, 6)
    expect(cadenzaKeyframedGlow(0.15)).toBeLessThan(1)
    expect(cadenzaKeyframedGlow(0.65)).toBeCloseTo(0.5, 6)
  })
  it('词级发光包络：升起 → 平台 → 衰减', () => {
    const first = target.words[0]!
    expect(cadenzaGlowEnvelope(0.5, timing, first)).toBe(0)
    expect(cadenzaGlowEnvelope(1.5, timing, first)).toBe(1)
    const decaying = cadenzaGlowEnvelope(2.4, timing, first)
    expect(decaying).toBeGreaterThan(0)
    expect(decaying).toBeLessThan(1)
    expect(cadenzaGlowEnvelope(9, timing, first)).toBeCloseTo(0, 6)
  })
  it('逐字发光按真实字素时序错开', () => {
    const first = target.words[0]!
    const timings = [
      { char: '遇', startTime: 1, endTime: 1.5 },
      { char: '见', startTime: 1.5, endTime: 2 },
    ]
    // 第一个字已经起光，第二个字还没开始。
    expect(cadenzaCharGlow(1.1, first, 0, 2, timings)).toBeGreaterThan(0)
    expect(cadenzaCharGlow(1.1, first, 1, 2, timings)).toBe(0)
    expect(cadenzaCharGlow(1.6, first, 1, 2, timings)).toBeGreaterThan(0)
  })
  it('整行进出场包络不越界', () => {
    for (let time = 0; time <= 6; time += 0.1) {
      const envelope = cadenzaLineEnvelope(time, target, timing)
      expect(envelope.opacity).toBeGreaterThanOrEqual(0)
      expect(envelope.opacity).toBeLessThanOrEqual(1)
      expect(envelope.blur).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(envelope.scale)).toBe(true)
    }
  })
  it('lineTransitionMode 为 none 时不做任何过渡', () => {
    const flat = line([word('a', 0, 1)], {
      renderHints: {
        rawDuration: 1,
        timingClass: 'normal',
        renderEndTime: 1,
        lineTransitionMode: 'none',
        wordRevealMode: 'normal',
      },
    })
    expect(
      cadenzaLineEnvelope(0.5, flat, resolveCadenzaLineTiming(flat))
    ).toEqual({
      opacity: 1,
      scale: 1,
      blur: 0,
    })
  })
  it('没有行时给中性包络', () => {
    expect(cadenzaLineEnvelope(0, null, timing)).toEqual({
      opacity: 1,
      scale: 1,
      blur: 0,
    })
  })
  it('过气漂移 5 秒走完', () => {
    const first = target.words[0]!
    expect(cadenzaPassedDrift(1.5, first)).toBe(0)
    expect(cadenzaPassedDrift(4.5, first)).toBeCloseTo(0.5, 6)
    expect(cadenzaPassedDrift(99, first)).toBe(1)
  })
})

describe('cadenza 逐帧状态', () => {
  const target = line([word('遇见', 1, 2), word('风景', 2, 3)])
  const timing = resolveCadenzaLineTiming(target)
  const prepared = buildCadenzaPlacements(
    [
      {
        line: {
          text: '',
          width: 240,
          start: { segmentIndex: 0, graphemeIndex: 0 },
          end: { segmentIndex: 0, graphemeIndex: 0 },
        },
        lineStart: 0,
        lineEnd: 4,
        fragments: target.words.map((item, index) => ({
          wordIndex: index,
          lineIndex: 0,
          word: item,
          text: item.text,
          color: '#e8c879',
          startX: index * 120,
          endX: (index + 1) * 120,
          fragmentStartInWord: 0,
          wordGraphemeCount: 2,
          wordGraphemeTimings: [],
          fragmentIndexInWord: 0,
          isPrimaryFragment: true,
          isSplitAcrossLines: false,
        })),
      },
    ],
    72,
    88,
    800,
    'normal',
    1000,
    false,
    true
  )
  const input = (
    overrides: Partial<CadenzaTargetInput> = {}
  ): CadenzaTargetInput => ({
    placement: prepared[0]!,
    placementIndex: 0,
    timeSec: 1.5,
    timing,
    theme,
    stageWidth: 1200,
    focusY: 300,
    motionEnergy: 0.5,
    staticMode: false,
    ...overrides,
  })

  it('目标状态在任意时刻都有界', () => {
    for (let time = -1; time <= 8; time += 0.1)
      for (const placement of prepared) {
        const result = cadenzaPlacementTarget(
          input({ placement, timeSec: time })
        )
        expect(result.bodyAlpha).toBeGreaterThanOrEqual(0)
        expect(result.bodyAlpha).toBeLessThanOrEqual(1)
        expect(result.activeMix).toBeGreaterThanOrEqual(0)
        expect(result.activeMix).toBeLessThanOrEqual(1)
        expect(result.blur).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(result.x)).toBe(true)
        expect(Number.isFinite(result.y)).toBe(true)
        expect(Number.isFinite(result.scale)).toBe(true)
      }
  })
  it('等待态隐藏且缩小，活跃态放大且不透明', () => {
    const waiting = cadenzaPlacementTarget(input({ timeSec: 0 }))
    expect(waiting.status).toBe('waiting')
    expect(waiting.bodyAlpha).toBe(0)
    expect(waiting.blur).toBeGreaterThan(0)
    const active = cadenzaPlacementTarget(input({ timeSec: 1.5 }))
    expect(active.status).toBe('active')
    expect(active.bodyAlpha).toBe(1)
    expect(active.scale).toBeGreaterThan(prepared[0]!.scale)
  })
  it('过气态保留部分不透明度并开始漂移', () => {
    const passed = cadenzaPlacementTarget(input({ timeSec: 4 }))
    expect(passed.status).toBe('passed')
    expect(passed.bodyAlpha).toBeCloseTo(0.82, 6)
    expect(passed.rotation).not.toBe(0)
  })
  it('静态模式给完整静止文字，没有脉动与发光', () => {
    const result = cadenzaPlacementTarget(input({ staticMode: true }))
    expect(result.bodyAlpha).toBe(1)
    expect(result.scale).toBe(prepared[0]!.scale)
    expect(result.rotation).toBe(0)
    expect(result.glowAlpha).toBe(0)
    expect(result.blur).toBe(0)
  })
  it('跟随器单调收敛到目标', () => {
    const goal = cadenzaPlacementTarget(input())
    const state = initialCadenzaState(prepared[0]!, goal, 1.5, false)
    const first = Math.abs(state.scale - goal.scale)
    for (let step = 0; step < 60; step += 1)
      followCadenzaState(state, goal, 1 / 60)
    expect(Math.abs(state.scale - goal.scale)).toBeLessThan(first)
    expect(state.scale).toBeCloseTo(goal.scale, 3)
    expect(state.bodyAlpha).toBeCloseTo(goal.bodyAlpha, 3)
  })
  it('掉帧不改变收敛速度 —— 一大步与多小步等效', () => {
    const goal = cadenzaPlacementTarget(input())
    const coarse = initialCadenzaState(prepared[0]!, goal, 1.5, false)
    const fine = { ...coarse }
    followCadenzaState(coarse, goal, 0.1)
    for (let step = 0; step < 6; step += 1)
      followCadenzaState(fine, goal, 0.1 / 6)
    expect(coarse.scale).toBeCloseTo(fine.scale, 2)
  })
  it('落位后状态与目标完全一致', () => {
    const goal = cadenzaPlacementTarget(input())
    const state = initialCadenzaState(prepared[0]!, goal, 1.5, false)
    snapCadenzaState(state, goal)
    expect(state.x).toBe(goal.x)
    expect(state.scale).toBe(goal.scale)
    expect(state.glowAlpha).toBe(goal.glowAlpha)
  })
  it('时间跳变按 Seek 处理，连续播放不算', () => {
    expect(isCadenzaSeek(null, 0)).toBe(true)
    expect(isCadenzaSeek(1, 1 + 1 / 60)).toBe(false)
    expect(isCadenzaSeek(30, 2)).toBe(true)
    expect(isCadenzaSeek(2, 30)).toBe(true)
  })
  it('instant 模式下已开始的词直接按目标初始化', () => {
    const goal = cadenzaPlacementTarget(input())
    expect(initialCadenzaState(prepared[0]!, goal, 1.5, true)).toEqual({
      ...goal,
    })
    // 尚未开始时仍然从缩小隐藏态入场。
    expect(initialCadenzaState(prepared[0]!, goal, 0, true).bodyAlpha).toBe(0)
  })
})

describe('cadenza 发光与涟漪', () => {
  it('用 drop-shadow 而不是 text-shadow', () => {
    const filter = cadenzaGlowFilter('#e8c879', 1)
    expect(filter).toContain('drop-shadow(')
    expect(filter).not.toContain('text-shadow')
    expect(filter.match(/drop-shadow\(/g)).toHaveLength(3)
  })
  it('强度为 0 时返回 none —— 不留常驻合成层', () => {
    expect(cadenzaGlowFilter('#e8c879', 0)).toBe('none')
    expect(cadenzaGlowFilter('#e8c879', 0.005)).toBe('none')
  })
  it('能量越高模糊半径越大', () => {
    const radius = (filter: string) =>
      Number(filter.match(/drop-shadow\(0 0 ([\d.]+)px/)![1])
    expect(radius(cadenzaGlowFilter('#e8c879', 1, 1.3))).toBeGreaterThan(
      radius(cadenzaGlowFilter('#e8c879', 1, 1))
    )
  })
  it('逐字发光只在 splitGlow 片段上按字错开', () => {
    const target = line([word('abcd', 1, 2)])
    const timing = resolveCadenzaLineTiming(target)
    const [split] = buildCadenzaPlacements(
      [
        {
          line: {
            text: '',
            width: 200,
            start: { segmentIndex: 0, graphemeIndex: 0 },
            end: { segmentIndex: 0, graphemeIndex: 0 },
          },
          lineStart: 0,
          lineEnd: 4,
          fragments: [
            {
              wordIndex: 0,
              lineIndex: 0,
              word: target.words[0]!,
              text: 'abcd',
              color: '#e8c879',
              startX: 0,
              endX: 200,
              fragmentStartInWord: 0,
              wordGraphemeCount: 4,
              wordGraphemeTimings: [],
              fragmentIndexInWord: 0,
              isPrimaryFragment: true,
              isSplitAcrossLines: false,
            },
          ],
        },
      ],
      72,
      88,
      800,
      'normal',
      1000,
      false,
      true
    )
    expect(split!.splitGlow).toBe(true)
    const head = cadenzaGraphemeGlow(split!, 0, 1.1, timing, 1, 1)
    const tail = cadenzaGraphemeGlow(split!, 3, 1.1, timing, 1, 1)
    expect(head).toBeGreaterThan(tail)
    // glowAlpha 或 glowIntensity 为 0 时整体关闭。
    expect(cadenzaGraphemeGlow(split!, 0, 1.1, timing, 0, 1)).toBe(0)
    expect(cadenzaGraphemeGlow(split!, 0, 1.1, timing, 1, 0)).toBe(0)
  })
  it('涟漪只在副歌的活跃词上出现，且随进度扩散变淡', () => {
    const target = line([word('遇见', 1, 2)], { isChorus: true })
    const timing = resolveCadenzaLineTiming(target)
    const [placement] = buildCadenzaPlacements(
      [
        {
          line: {
            text: '',
            width: 120,
            start: { segmentIndex: 0, graphemeIndex: 0 },
            end: { segmentIndex: 0, graphemeIndex: 0 },
          },
          lineStart: 0,
          lineEnd: 2,
          fragments: [
            {
              wordIndex: 0,
              lineIndex: 0,
              word: target.words[0]!,
              text: '遇见',
              color: '#e8c879',
              startX: 0,
              endX: 120,
              fragmentStartInWord: 0,
              wordGraphemeCount: 2,
              wordGraphemeTimings: [],
              fragmentIndexInWord: 0,
              isPrimaryFragment: true,
              isSplitAcrossLines: false,
            },
          ],
        },
      ],
      72,
      88,
      800,
      'normal',
      1000,
      false,
      true
    )
    const makeFrame = (timeSec: number) => {
      const goal = cadenzaPlacementTarget({
        placement: placement!,
        placementIndex: 0,
        timeSec,
        timing,
        theme,
        stageWidth: 1200,
        focusY: 300,
        motionEnergy: 0,
        staticMode: false,
      })
      return { goal, state: { ...goal } }
    }
    const early = makeFrame(1.1)
    const late = makeFrame(1.9)
    const earlyRipple = cadenzaRipple(placement!, early.goal, early.state, true)
    const lateRipple = cadenzaRipple(placement!, late.goal, late.state, true)
    expect(earlyRipple).not.toBeNull()
    expect(lateRipple!.size).toBeGreaterThan(earlyRipple!.size)
    expect(lateRipple!.opacity).toBeLessThan(earlyRipple!.opacity)
    // 非副歌、非活跃态都不出涟漪。
    expect(cadenzaRipple(placement!, early.goal, early.state, false)).toBeNull()
    const waiting = makeFrame(0)
    expect(
      cadenzaRipple(placement!, waiting.goal, waiting.state, true)
    ).toBeNull()
  })
})
