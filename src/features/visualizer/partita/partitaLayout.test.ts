import { describe, expect, it } from 'vitest'
import type { Line, Word } from '../../lyrics/folia/model'
import { FALLBACK_DUAL_THEME } from '../../theme/sanitize'
import type { Theme } from '../../theme/model'
import {
  partitaChunkFrame,
  partitaChunkStatus,
  preparePartitaLine,
} from './partitaFrame'
import {
  buildPartitaLayout,
  DEFAULT_PARTITA_TUNING,
  EMPTY_PARTITA_LAYOUT,
  partitaDensityScale,
  partitaFontSize,
  partitaLayoutCacheKey,
  partitaWordConfig,
  resolvePartitaTuning,
} from './partitaLayout'

const word = (text: string, startTime: number, endTime: number): Word => ({
  text,
  startTime,
  endTime,
})
const makeLine = (words: Word[], extra: Partial<Line> = {}): Line => ({
  words,
  startTime: words[0]?.startTime ?? 0,
  endTime: words[words.length - 1]?.endTime ?? 1,
  fullText: words.map(item => item.text).join(''),
  ...extra,
})
const theme = (intensity: Theme['animationIntensity'] = 'normal'): Theme => ({
  ...FALLBACK_DUAL_THEME.dark,
  animationIntensity: intensity,
})

// 八个词，足够切出多行。
const words = [
  word('在', 0, 0.5),
  word('声', 0.5, 1),
  word('音', 1, 1.5),
  word('里', 1.5, 2),
  word('遇', 2, 2.5),
  word('见', 2.5, 3),
  word('风', 3, 3.5),
  word('景', 3.5, 4),
]
const line = makeLine(words)
const input = {
  line,
  theme: theme(),
  stageHeight: 800,
  tuning: DEFAULT_PARTITA_TUNING,
}

describe('partita 调参', () => {
  it('缺省值与上游 DEFAULT_PARTITA_TUNING 一致', () => {
    expect(resolvePartitaTuning()).toEqual(DEFAULT_PARTITA_TUNING)
    expect(DEFAULT_PARTITA_TUNING).toEqual({
      showGuideLines: true,
      useSemanticLayout: true,
      staggerMin: 20,
      staggerMax: 100,
    })
  })
  it('错落幅度限幅在 0..180', () => {
    expect(resolvePartitaTuning({ staggerMax: 999 }).staggerMax).toBe(180)
    expect(resolvePartitaTuning({ staggerMin: -5 }).staggerMin).toBe(0)
  })
  it('min 与 max 传反了也能用', () => {
    const tuning = resolvePartitaTuning({ staggerMin: 120, staggerMax: 30 })
    expect(tuning.staggerMin).toBe(30)
    expect(tuning.staggerMax).toBe(120)
  })
  it('非数字退回缺省而不是 NaN', () => {
    expect(resolvePartitaTuning({ staggerMin: Number.NaN }).staggerMin).toBe(
      DEFAULT_PARTITA_TUNING.staggerMin
    )
  })
})

describe('partita 分行', () => {
  it('同一行反复构建得到相同构图 —— 时间只改状态，不改几何', () => {
    expect(buildPartitaLayout(input)).toEqual(buildPartitaLayout(input))
  })
  it('chunk 拼接后不丢词', () => {
    const { chunks } = buildPartitaLayout(input)
    const flat = chunks.flatMap(chunk => chunk.chunkWords)
    expect(flat).toHaveLength(words.length)
    expect(flat.map(item => item.text).join('')).toBe(line.fullText)
  })
  it('行数受舞台高度限制', () => {
    // 800 * 0.65 / 100 = 5 行上限。
    expect(buildPartitaLayout(input).chunks.length).toBeLessThanOrEqual(5)
    // 矮舞台只剩一行。
    const short = buildPartitaLayout({ ...input, stageHeight: 150 })
    expect(short.chunks).toHaveLength(1)
    expect(short.chunks[0]!.chunkWords).toHaveLength(words.length)
  })
  it('行数不超过布局单元数', () => {
    const single = makeLine([word('光', 0, 1)])
    const layout = buildPartitaLayout({ ...input, line: single })
    expect(layout.chunks).toHaveLength(1)
  })
  it('每个 chunk 至少一个词', () => {
    for (const stageHeight of [200, 400, 800, 1600])
      for (const chunk of buildPartitaLayout({ ...input, stageHeight }).chunks)
        expect(chunk.chunkWords.length).toBeGreaterThan(0)
  })
  it('错落方向按行序左右交替', () => {
    const { chunks } = buildPartitaLayout(input)
    for (const chunk of chunks) {
      const left = chunk.rowIndex % 2 === 0
      expect(Math.sign(chunk.config.x)).toBe(left ? -1 : 1)
    }
  })
  it('错落幅度落在调参区间内', () => {
    const { chunks } = buildPartitaLayout(input)
    for (const chunk of chunks) {
      const magnitude = Math.abs(chunk.config.x)
      expect(magnitude).toBeGreaterThanOrEqual(
        DEFAULT_PARTITA_TUNING.staggerMin
      )
      expect(magnitude).toBeLessThanOrEqual(DEFAULT_PARTITA_TUNING.staggerMax)
    }
  })
  it('calm 强度下不旋转、不竖向偏移、缩放为 1', () => {
    const { chunks } = buildPartitaLayout({ ...input, theme: theme('calm') })
    for (const chunk of chunks) {
      expect(chunk.config.rotate).toBe(0)
      expect(chunk.config.y).toBe(0)
      expect(chunk.config.scale).toBe(1)
    }
  })
  it('chaotic 强度下透视更近', () => {
    expect(buildPartitaLayout(input).perspective).toBe(1000)
    expect(
      buildPartitaLayout({ ...input, theme: theme('chaotic') }).perspective
    ).toBe(720)
  })
  it('没有词时返回空 chunk 而不是抛错', () => {
    const empty = makeLine([])
    const layout = buildPartitaLayout({ ...input, line: empty })
    expect(layout.chunks).toEqual([])
    expect(EMPTY_PARTITA_LAYOUT.chunks).toEqual([])
  })
})

describe('partita 缓存键', () => {
  it('同样输入得到同一个键', () => {
    expect(
      partitaLayoutCacheKey(line, theme(), 800, DEFAULT_PARTITA_TUNING)
    ).toBe(partitaLayoutCacheKey(line, theme(), 800, DEFAULT_PARTITA_TUNING))
  })
  it('歌词、强度与调参变化都会换键', () => {
    const base = partitaLayoutCacheKey(
      line,
      theme(),
      800,
      DEFAULT_PARTITA_TUNING
    )
    expect(
      partitaLayoutCacheKey(
        makeLine([word('别', 0, 1)]),
        theme(),
        800,
        DEFAULT_PARTITA_TUNING
      )
    ).not.toBe(base)
    expect(
      partitaLayoutCacheKey(line, theme('chaotic'), 800, DEFAULT_PARTITA_TUNING)
    ).not.toBe(base)
    expect(
      partitaLayoutCacheKey(line, theme(), 800, {
        ...DEFAULT_PARTITA_TUNING,
        staggerMax: 60,
      })
    ).not.toBe(base)
  })
  it('高度按 24px 分桶：同桶内不换键，相差一桶以上必换键', () => {
    const key = (height: number) =>
      partitaLayoutCacheKey(line, theme(), height, DEFAULT_PARTITA_TUNING)
    // 分桶用 round(h/24)，所以桶边界落在 24 的倍数 ±12 上；
    // 取样时必须确保两个值落在同一桶内，而不是赌具体数字。
    const bucket = (height: number) => Math.round(height / 24)
    expect(bucket(800)).toBe(bucket(803))
    expect(key(800)).toBe(key(803))
    // 相差一整桶必然换键。
    expect(bucket(800)).not.toBe(bucket(824))
    expect(key(800)).not.toBe(key(824))
    expect(key(800)).not.toBe(key(900))
  })
  it('保存的分词计入键 —— 否则重新分词后屏幕上那一行会留着旧布局', () => {
    const base = partitaLayoutCacheKey(
      line,
      theme(),
      800,
      DEFAULT_PARTITA_TUNING
    )
    const resegmented = makeLine(words, {
      wordSegments: ['在声音里', '遇见风景'],
    })
    expect(
      partitaLayoutCacheKey(resegmented, theme(), 800, DEFAULT_PARTITA_TUNING)
    ).not.toBe(base)
  })
})

describe('partita 词级抖动', () => {
  it('同一词反复求值结果相同', () => {
    const { chunks } = buildPartitaLayout(input)
    const chunk = chunks[0]!
    expect(partitaWordConfig(chunk, 0, theme())).toEqual(
      partitaWordConfig(chunk, 0, theme())
    )
  })
  it('calm 强度下不抖动、不旋转', () => {
    const { chunks } = buildPartitaLayout({ ...input, theme: theme('calm') })
    const config = partitaWordConfig(chunks[0]!, 0, theme('calm'))
    expect(config.x).toBeCloseTo(0, 10)
    expect(config.y).toBeCloseTo(0, 10)
    expect(config.rotate).toBeCloseTo(0, 10)
  })
  it('词继承所在 chunk 的缩放', () => {
    const { chunks } = buildPartitaLayout(input)
    const chunk = chunks[0]!
    expect(partitaWordConfig(chunk, 0, theme()).scale).toBe(chunk.config.scale)
  })
  it('同一 chunk 内不同词得到不同抖动', () => {
    const { chunks } = buildPartitaLayout(input)
    const chunk = chunks.find(item => item.displayWords.length > 1)
    if (!chunk) return
    expect(partitaWordConfig(chunk, 0, theme())).not.toEqual(
      partitaWordConfig(chunk, 1, theme())
    )
  })
})

describe('partita 字号', () => {
  it('字数密集时缩一档', () => {
    expect(partitaDensityScale(10)).toBe(1)
    expect(partitaDensityScale(41)).toBe(0.8)
  })
  it('字号随倍率线性变化', () => {
    expect(partitaFontSize(10, 1)).toContain('2.500rem')
    expect(partitaFontSize(10, 2)).toContain('5.000rem')
    // 密集时整体缩小。
    expect(partitaFontSize(50, 1)).toContain('2.000rem')
  })
})

describe('partita chunk 状态与帧', () => {
  const prepared = preparePartitaLine(input)

  it('编译出的 chunk 时间边界来自原始计时词', () => {
    for (const chunk of prepared.chunks) {
      expect(chunk.startTime).toBe(chunk.chunk.chunkWords[0]!.startTime)
      expect(chunk.endTime).toBeGreaterThanOrEqual(chunk.startTime)
    }
  })
  it('导引线按行序左右交替', () => {
    for (const chunk of prepared.chunks)
      expect(chunk.guide).toBe(
        chunk.chunk.rowIndex % 2 === 0 ? 'left' : 'right'
      )
  })
  it('三态按 chunk 的时间边界判定', () => {
    const chunk = prepared.chunks[0]!
    expect(partitaChunkStatus(-1, chunk, prepared.profile)).toBe('waiting')
    expect(
      partitaChunkStatus(chunk.startTime + 0.01, chunk, prepared.profile)
    ).toBe('active')
    expect(partitaChunkStatus(chunk.endTime + 1, chunk, prepared.profile)).toBe(
      'passed'
    )
  })
  it('前瞻窗口内提前进入 active', () => {
    const chunk = prepared.chunks[0]!
    const lookahead = prepared.profile.wordLookahead
    expect(
      partitaChunkStatus(
        chunk.startTime - lookahead + 0.001,
        chunk,
        prepared.profile
      )
    ).toBe('active')
    expect(
      partitaChunkStatus(
        chunk.startTime - lookahead - 0.1,
        chunk,
        prepared.profile
      )
    ).toBe('waiting')
  })
  it('waiting 时完全透明且朝导引线一侧退开', () => {
    const chunk = prepared.chunks[0]!
    const frame = partitaChunkFrame(chunk, prepared.profile, -5)
    expect(frame.opacity).toBe(0)
    expect(frame.status).toBe('waiting')
    // 左侧导引线的 chunk 向左退。
    const offset = chunk.guide === 'left' ? -40 : 40
    const expected = chunk.chunk.config.x + offset
    expect(frame.transform).toContain(expected.toFixed(3))
  })
  it('active 时归位并点亮导引线', () => {
    const chunk = prepared.chunks[0]!
    const frame = partitaChunkFrame(chunk, prepared.profile, chunk.endTime)
    expect(frame.opacity).toBeGreaterThan(0.9)
    expect(frame.guideColor).toBe(chunk.activeColor)
    expect(frame.guideGlowVertical).toContain('rgba(')
    expect(frame.guideScale).toBeGreaterThan(0.9)
  })
  it('passed 时导引线转为淡白而不是继续发光', () => {
    const chunk = prepared.chunks[0]!
    const frame = partitaChunkFrame(chunk, prepared.profile, chunk.endTime + 2)
    expect(frame.status).toBe('passed')
    expect(frame.guideColor).toBe('rgba(255, 255, 255, 0.22)')
    expect(frame.guideGlowVertical).toBe('none')
  })
  it('静态模式给完整画面且不发光', () => {
    const chunk = prepared.chunks[0]!
    const frame = partitaChunkFrame(chunk, prepared.profile, 0, true)
    expect(frame.opacity).toBe(1)
    expect(frame.transform).toBe('none')
    expect(frame.guideGlowVertical).toBe('none')
    expect(frame.guideScale).toBe(1)
  })
  it('透明度与导引线展开比例始终落在 0..1', () => {
    const chunk = prepared.chunks[0]!
    for (let time = -2; time <= 8; time += 0.1) {
      const frame = partitaChunkFrame(chunk, prepared.profile, time)
      expect(frame.opacity).toBeGreaterThanOrEqual(0)
      expect(frame.opacity).toBeLessThanOrEqual(1)
      expect(frame.guideScale).toBeGreaterThanOrEqual(0)
      expect(frame.guideScale).toBeLessThanOrEqual(1)
    }
  })
  it('每个词都带发光时序', () => {
    for (const chunk of prepared.chunks)
      for (const item of chunk.words) {
        expect(item.graphemes.length).toBeGreaterThan(0)
        for (const grapheme of item.graphemes)
          expect(grapheme.timing.durationSec).toBeGreaterThan(0)
      }
  })
  it('全是估计词时仍完整显示整句 —— 普通 LRC 在 SOEI 里 words 为空，不兜底就什么都不显示', () => {
    // SOEI 的 adapter 只在 timing === 'word' 时产出 words，所以纯 LRC 的 words 是空数组。
    const plain: Line = {
      words: [],
      startTime: 0,
      endTime: 4,
      fullText: '在声音里遇见风景',
    }
    const compiled = preparePartitaLine({ ...input, line: plain })
    expect(compiled.chunks).toHaveLength(1)
    const chunk = compiled.chunks[0]!
    expect(chunk.chunk.displayWords.map(item => item.text).join('')).toBe(
      plain.fullText
    )
    // 没有真实词时间，所以不该呈现演唱高亮。
    expect(chunk.words.every(item => item.word.estimated)).toBe(true)
  })
  it('纯 LRC 行的时间边界覆盖整句', () => {
    const plain: Line = {
      words: [],
      startTime: 2,
      endTime: 6,
      fullText: '把这一刻轻轻收藏',
    }
    const chunk = preparePartitaLine({ ...input, line: plain }).chunks[0]!
    expect(chunk.startTime).toBe(2)
    expect(chunk.endTime).toBeGreaterThanOrEqual(6)
  })
  it('空文本的行不产出 chunk', () => {
    const blank: Line = { words: [], startTime: 0, endTime: 1, fullText: '' }
    expect(preparePartitaLine({ ...input, line: blank }).chunks).toEqual([])
  })
})
