import { describe, expect, it } from 'vitest'
import { generateDualTheme, seededRandom } from './generateTheme'
import { extractRepresentativeColorsFromPixels } from './medianCut'
import { getContrastRatio } from './colorMath'
import {
  ACCENT_MIN_CONTRAST,
  PRIMARY_MIN_CONTRAST,
  SECONDARY_MIN_CONTRAST,
} from './colorRanges'
import { sanitizeDualTheme, FALLBACK_DUAL_THEME } from './sanitize'
import { themeVariables } from './cssVariables'

// 构造 size×size 的 RGBA 像素块：前 ratio 比例是 primary，其余是 secondary。
function pixels(
  primary: [number, number, number],
  secondary: [number, number, number],
  ratio = 0.75,
  size = 10
): Uint8ClampedArray {
  const total = size * size
  const data = new Uint8ClampedArray(total * 4)
  for (let index = 0; index < total; index += 1) {
    const [r, g, b] = index < total * ratio ? primary : secondary
    data[index * 4] = r
    data[index * 4 + 1] = g
    data[index * 4 + 2] = b
    data[index * 4 + 3] = 255
  }
  return data
}

describe('封面中位切分取色', () => {
  it('按像素占比排序，面积大的颜色在前', () => {
    const colors = extractRepresentativeColorsFromPixels(
      pixels([200, 40, 40], [40, 60, 200]),
      2
    )
    expect(colors).toHaveLength(2)
    expect(colors[0]).toBe('#c82828')
    expect(colors[1]).toBe('#283cc8')
  })
  it('忽略透明像素', () => {
    const data = pixels([200, 40, 40], [40, 60, 200])
    for (let index = 0; index < data.length; index += 4) data[index + 3] = 0
    expect(extractRepresentativeColorsFromPixels(data, 3)).toEqual([])
  })
  it('纯色封面不会被切成多个桶', () => {
    expect(
      extractRepresentativeColorsFromPixels(
        pixels([18, 24, 28], [18, 24, 28]),
        5
      )
    ).toEqual(['#12181c'])
  })
  it('count 非正时返回空', () => {
    expect(
      extractRepresentativeColorsFromPixels(pixels([1, 2, 3], [4, 5, 6]), 0)
    ).toEqual([])
  })
})

describe('主题生成', () => {
  it('同一种子得到完全相同的主题', () => {
    const coverColors = ['#7cacc8', '#e8c879']
    const first = generateDualTheme({
      coverColors,
      random: seededRandom('track-1'),
    })
    const second = generateDualTheme({
      coverColors,
      random: seededRandom('track-1'),
    })
    expect(first).toEqual(second)
  })
  it('不同曲目得到不同主题', () => {
    const coverColors = ['#7cacc8', '#e8c879']
    const first = generateDualTheme({
      coverColors,
      random: seededRandom('track-1'),
    })
    const other = generateDualTheme({
      coverColors,
      random: seededRandom('track-2'),
    })
    expect(first).not.toEqual(other)
  })
  it('空种子不会退化成常量序列', () => {
    const random = seededRandom('')
    const values = [random(), random(), random()]
    expect(new Set(values).size).toBe(3)
  })
  it('文字色全部满足各自的对比度下限', () => {
    const covers = [
      ['#7cacc8', '#e8c879'],
      ['#101010', '#121212'],
      ['#ff0000'],
      [],
    ]
    for (const coverColors of covers)
      for (const seed of ['a', 'b', 'song-03', '一首歌']) {
        const dual = generateDualTheme({
          coverColors,
          random: seededRandom(seed),
        })
        for (const theme of [dual.light, dual.dark]) {
          const background = theme.backgroundColor
          expect(
            getContrastRatio(theme.primaryColor, background)
          ).toBeGreaterThanOrEqual(PRIMARY_MIN_CONTRAST)
          expect(
            getContrastRatio(theme.accentColor, background)
          ).toBeGreaterThanOrEqual(ACCENT_MIN_CONTRAST)
          expect(
            getContrastRatio(theme.secondaryColor, background)
          ).toBeGreaterThanOrEqual(SECONDARY_MIN_CONTRAST)
        }
      }
  })
  it('亮色侧背景比暗色侧亮，且两面共用名称前缀', () => {
    const dual = generateDualTheme({
      coverColors: ['#7cacc8'],
      random: seededRandom('track-1'),
    })
    expect(
      getContrastRatio(dual.light.backgroundColor, '#ffffff')
    ).toBeLessThan(getContrastRatio(dual.dark.backgroundColor, '#ffffff'))
    expect(dual.light.name.slice(0, 2)).toBe(dual.dark.name.slice(0, 2))
  })
  it('沿用 SOEI 的衬线基调', () => {
    const dual = generateDualTheme({ random: seededRandom('track-1') })
    expect(dual.dark.fontStyle).toBe('serif')
  })
})

describe('主题净化', () => {
  it('手写的兜底主题本身也满足对比度下限', () => {
    for (const theme of [FALLBACK_DUAL_THEME.light, FALLBACK_DUAL_THEME.dark]) {
      const background = theme.backgroundColor
      expect(
        getContrastRatio(theme.primaryColor, background)
      ).toBeGreaterThanOrEqual(PRIMARY_MIN_CONTRAST)
      expect(
        getContrastRatio(theme.accentColor, background)
      ).toBeGreaterThanOrEqual(ACCENT_MIN_CONTRAST)
      expect(
        getContrastRatio(theme.secondaryColor, background)
      ).toBeGreaterThanOrEqual(SECONDARY_MIN_CONTRAST)
    }
  })
  it('非法输入退回兜底主题', () => {
    expect(sanitizeDualTheme(null)).toEqual(FALLBACK_DUAL_THEME)
    expect(sanitizeDualTheme({ light: 'nope', dark: 42 })).toEqual(
      FALLBACK_DUAL_THEME
    )
  })
  it('三位 hex 展开成六位，非法颜色退回兜底色', () => {
    const dual = sanitizeDualTheme({
      dark: { accentColor: '#abc', primaryColor: 'rgb(1,2,3)' },
    })
    expect(dual.dark.accentColor).toBe('#aabbcc')
    // rgb() 不是合法的 Theme 颜色字段，退回兜底。
    expect(dual.dark.primaryColor).toBe(FALLBACK_DUAL_THEME.dark.primaryColor)
  })
  it('丢弃没有文字的 wordColors 条目', () => {
    const dual = sanitizeDualTheme({
      dark: { wordColors: [{ word: '  ', color: '#fff' }, { word: '光' }] },
    })
    expect(dual.dark.wordColors).toEqual([
      { word: '光', color: FALLBACK_DUAL_THEME.dark.accentColor },
    ])
  })
})

describe('CSS 变量输出', () => {
  it('把点缀色接到 SOEI 已有的氛围与舞台变量上', () => {
    const variables = themeVariables(FALLBACK_DUAL_THEME.dark)
    const accent = FALLBACK_DUAL_THEME.dark.accentColor
    expect(variables['--theme-accent']).toBe(accent)
    expect(variables['--ambient-color']).toBe(accent)
    expect(variables['--stage-color']).toBe(accent)
    expect(variables['--theme-glow']).toContain('rgba(')
  })
})
