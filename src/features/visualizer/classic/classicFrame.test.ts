import { describe, expect, it } from 'vitest'
import type { Line } from '../../lyrics/folia/model'
import { FALLBACK_DUAL_THEME } from '../../theme/sanitize'
import {
  classicDisplayWords,
  classicLineFrame,
  classicWordFrame,
  prepareClassicLine,
} from './classicFrame'
import { DEFAULT_CLASSIC_TUNING, resolveClassicTuning } from './classicLayout'

const theme = FALLBACK_DUAL_THEME.dark
const line: Line = {
  startTime: 1,
  endTime: 8,
  fullText: '光的回声',
  words: [
    { text: '光的', startTime: 1, endTime: 3 },
    { text: '回声', startTime: 3, endTime: 8 },
  ],
  isChorus: true,
}
const prepare = (input: Line = line) =>
  prepareClassicLine({
    line: input,
    theme,
    tuning: DEFAULT_CLASSIC_TUNING,
    lyricsFontScale: 1,
    viewportWidth: 1200,
  })

describe('classic 绝对时间动画', () => {
  it('换个分镜改变几何，反复回到相同种子仍可还原', () => {
    const base = {
      line,
      theme,
      tuning: DEFAULT_CLASSIC_TUNING,
      lyricsFontScale: 1,
      viewportWidth: 1200,
    }
    const first = prepareClassicLine({ ...base, seed: 5 })
    expect(first).toEqual(prepareClassicLine({ ...base, seed: 5 }))
    expect(first.words.map(item => item.config)).not.toEqual(
      prepareClassicLine({ ...base, seed: 6 }).words.map(item => item.config)
    )
  })
  it('instant 短句的词立即可见，保留阅读时间', () => {
    const prepared = prepare({
      ...line,
      renderHints: {
        rawDuration: 0.1,
        renderEndTime: 1.1,
        timingClass: 'short',
        lineTransitionMode: 'none',
        wordRevealMode: 'instant',
      },
    })
    const frame = classicWordFrame(
      prepared.words[0]!,
      prepared.profile,
      1.01,
      theme
    )
    expect(frame.opacity).toBe(1)
    expect(frame.blur).toBeLessThan(10)
  })
  it('无法对齐的词片段不会重复正文或伪造高亮', () => {
    const words = classicDisplayWords(
      {
        ...line,
        fullText: 'Hello world',
        words: [
          { text: 'Hello', startTime: 1, endTime: 3 },
          { text: 'WORLD', startTime: 3, endTime: 8 },
        ],
      },
      DEFAULT_CLASSIC_TUNING
    )
    expect(words).toHaveLength(1)
    expect(words[0]!.text).toBe('Hello world')
    expect(words[0]!.estimated).toBe(true)
  })

  it('同句回拖或重新进入恢复同一帧，不依赖历史动画状态', () => {
    const prepared = prepare()
    const first = classicWordFrame(
      prepared.words[1]!,
      prepared.profile,
      4,
      theme
    )
    classicWordFrame(prepared.words[1]!, prepared.profile, 7, theme)
    expect(
      classicWordFrame(prepared.words[1]!, prepared.profile, 4, theme)
    ).toEqual(first)
    const reentered = prepare()
    expect(
      classicWordFrame(reentered.words[1]!, reentered.profile, 4, theme)
    ).toEqual(first)
    expect(classicLineFrame(reentered, 4)).toEqual(
      classicLineFrame(prepared, 4)
    )
  })
  it('晚挂载直接显示唱到的位置，不从 waiting 重播', () => {
    const prepared = prepare()
    const frame = classicWordFrame(
      prepared.words[1]!,
      prepared.profile,
      4,
      theme
    )
    expect(frame.status).toBe('active')
    expect(frame.opacity).toBe(1)
    expect(frame.blur).toBe(0)
    expect(frame.glows.some(glow => glow.includes('drop-shadow'))).toBe(true)
  })
  it('拖回未唱到的词时立刻隐藏高亮和涟漪', () => {
    const prepared = prepare()
    const frame = classicWordFrame(
      prepared.words[1]!,
      prepared.profile,
      1.5,
      theme
    )
    expect(frame.status).toBe('waiting')
    expect(frame.opacity).toBe(0)
    expect(frame.glows).toEqual(['none', 'none'])
    expect(frame.rippleOpacity).toBe(0)
  })
  it('唱过后余晖消退，旋转与布局仍由时间确定', () => {
    const prepared = prepare()
    const frame = classicWordFrame(
      prepared.words[0]!,
      prepared.profile,
      6,
      theme
    )
    expect(frame.status).toBe('passed')
    expect(frame.opacity).toBeCloseTo(0.82)
    expect(frame.glows).toEqual(['none', 'none'])
    expect(frame.transform).not.toContain('NaN')
  })
  it('省电或减少动态效果保留整句，无旋转、模糊、光晕或呼吸', () => {
    const prepared = prepare()
    for (const word of prepared.words) {
      const frame = classicWordFrame(word, prepared.profile, 1.2, theme, true)
      expect(frame.opacity).toBe(1)
      expect(frame.transform).toBe('none')
      expect(frame.blur).toBe(0)
      expect(frame.glows.every(glow => glow === 'none')).toBe(true)
      expect(frame.rippleOpacity).toBe(0)
    }
    expect(classicLineFrame(prepared, 1, true)).toEqual({
      opacity: 1,
      transform: 'none',
      filter: 'none',
      floatTransform: 'none',
    })
  })
  it('整行淡入淡出服从行时序，短句也能读完', () => {
    const prepared = prepare()
    expect(classicLineFrame(prepared, 1).opacity).toBe(0)
    expect(classicLineFrame(prepared, 2).opacity).toBe(1)
    expect(classicLineFrame(prepared, 9).opacity).toBe(0)
    const short = prepare({
      ...line,
      startTime: 1,
      endTime: 1.1,
      renderHints: {
        rawDuration: 0.1,
        renderEndTime: 1.1,
        timingClass: 'short',
        lineTransitionMode: 'none',
        wordRevealMode: 'instant',
      },
    })
    expect(classicLineFrame(short, 1.02).opacity).toBe(1)
  })
  it('普通 LRC 和预览保留完整原文，不合成演唱时间', () => {
    const untimed = { ...line, words: [], fullText: '把声音交给此刻' }
    const prepared = prepare(untimed)
    expect(prepared.words).toHaveLength(1)
    expect(prepared.words[0]!.word.text).toBe(untimed.fullText)
    const frame = classicWordFrame(
      prepared.words[0]!,
      prepared.profile,
      4,
      theme
    )
    expect(frame.opacity).toBe(1)
    expect(frame.color).toBe(theme.primaryColor)
    expect(frame.glows.every(glow => glow === 'none')).toBe(true)
  })
  it('保留词数组没有携带的英文空格和末尾标点', () => {
    const english = {
      ...line,
      fullText: 'Hello, world!',
      words: [
        { text: 'Hello', startTime: 1, endTime: 3 },
        { text: 'world', startTime: 3, endTime: 8 },
      ],
    }
    const words = classicDisplayWords(english, DEFAULT_CLASSIC_TUNING)
    expect(words.map(word => word.text).join('')).toBe('Hello, world!')
    expect(words.filter(word => word.estimated).map(word => word.text)).toEqual(
      [', ', '!']
    )
    expect(english.words).toHaveLength(2)
  })
  it('组合字素与 syllable 时间得到完整保留', () => {
    const prepared = prepare({
      ...line,
      fullText: '👨‍👩‍👧‍👦é',
      words: [
        {
          text: '👨‍👩‍👧‍👦é',
          startTime: 1,
          endTime: 8,
          syllables: [
            { text: '👨‍👩‍👧‍👦', startTime: 1, endTime: 2 },
            { text: 'é', startTime: 4, endTime: 8 },
          ],
        },
      ],
    })
    expect(prepared.words[0]!.graphemes.map(item => item.char)).toEqual([
      '👨‍👩‍👧‍👦',
      'é',
    ])
    expect(prepared.words[0]!.graphemes[1]!.timing.delaySec).toBe(3)
  })
  it('关键字配色来自封面主题', () => {
    const coloredTheme = {
      ...theme,
      wordColors: [{ word: '回声', color: '#ff7700' }],
    }
    const prepared = prepareClassicLine({
      line,
      theme: coloredTheme,
      tuning: DEFAULT_CLASSIC_TUNING,
      lyricsFontScale: 1,
      viewportWidth: 1200,
    })
    expect(prepared.words[1]!.activeColor).toBe('#ff7700')
  })
  it('畸形或旧版持久化参数回落到合法默认值', () => {
    for (const value of [
      null,
      'broken',
      { wordSpacing: NaN },
      { breathingFloatMultiplier: Infinity },
      { enableWordRotation: 'false' },
    ])
      expect(resolveClassicTuning(value)).toEqual(DEFAULT_CLASSIC_TUNING)
  })
})
