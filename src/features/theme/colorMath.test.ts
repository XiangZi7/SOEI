import { describe, expect, it } from 'vitest'
import {
  adjustLightnessForContrast,
  getContrastRatio,
  hexToHsl,
  hslToHex,
  mixHexColors,
  normalizeHue,
  parseColorChannels,
  rgbToHsl,
} from './colorMath'

describe('色彩数学', () => {
  it('解析三位与六位 hex 以及 rgb()', () => {
    expect(parseColorChannels('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseColorChannels('#e8c879')).toEqual({ r: 232, g: 200, b: 121 })
    expect(parseColorChannels('rgb(10, 20, 30)')).toEqual({
      r: 10,
      g: 20,
      b: 30,
    })
    expect(parseColorChannels('not-a-color')).toBeNull()
    expect(parseColorChannels('')).toBeNull()
  })
  it('hex 与 hsl 往返保持颜色', () => {
    for (const color of ['#e8c879', '#050809', '#7cacc8', '#808080']) {
      const hsl = hexToHsl(color)
      expect(hsl).not.toBeNull()
      expect(hslToHex(hsl!)).toBe(color)
    }
  })
  it('灰色的饱和度为零，色相归一化到 0..360', () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0)
    expect(normalizeHue(-30)).toBe(330)
    expect(normalizeHue(390)).toBe(30)
  })
  it('混色按比例插值并停在端点', () => {
    expect(mixHexColors('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHexColors('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mixHexColors('#000000', '#ffffff', 0.5)).toBe('#808080')
    // 比例越界时截断而不是外推。
    expect(mixHexColors('#000000', '#ffffff', 2)).toBe('#ffffff')
  })
  it('对比度计算对称且白黑为 21:1', () => {
    expect(getContrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })
  it('对比度求解保留色相并越过下限', () => {
    const background = '#050809'
    const source = '#1d4f6b'
    const solved = adjustLightnessForContrast(source, background, 9)
    expect(getContrastRatio(solved, background)).toBeGreaterThanOrEqual(9)
    // 只动亮度：色相保持不变，不塌成硬编码的近白色。
    expect(hexToHsl(solved)!.h).toBeCloseTo(hexToHsl(source)!.h, 0)
    expect(solved).not.toBe('#ffffff')
  })
  it('下限不可达时返回对比度最好的候选而不是原色', () => {
    // 纯黄对纯白无论怎么调亮度都到不了 21:1。
    const solved = adjustLightnessForContrast('#ffff00', '#ffffff', 21)
    expect(getContrastRatio(solved, '#ffffff')).toBeGreaterThan(
      getContrastRatio('#ffff00', '#ffffff')
    )
  })
})
