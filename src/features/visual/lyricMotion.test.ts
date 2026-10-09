import { describe, expect, it } from 'vitest'
import { parseLrc } from '../lyrics/lrc'
import { lyricGlyphs } from './lyricText'
import {
  lyricCameraFrame,
  lyricGlyphFrame,
  lyricInkProgress,
  planLyricMotion,
} from './lyricMotion'

function plan(
  text = '[00:01]让每一句，都有自己的光',
  endMs = 5000,
  variant = 0
) {
  const line = parseLrc(text)[0]!
  return planLyricMotion({
    line,
    endMs,
    glyphs: lyricGlyphs(line.text),
    layout: 'montage',
    variant,
  })
}

describe('歌词绝对时间动效', () => {
  it('顺播、同句前后跳转和重建舞台得到相同画面', () => {
    const motion = plan()
    const frameAt = (time: number) => ({
      glyph: lyricGlyphFrame(motion, 3, time),
      camera: lyricCameraFrame(motion, time),
      ink: lyricInkProgress(motion, time),
    })
    const first = frameAt(1240)
    for (const time of [1600, 2800, 4900, 1000, 1200]) frameAt(time)
    expect(frameAt(1240)).toEqual(first)
    expect(lyricGlyphFrame(plan(), 3, 1240)).toEqual(first.glyph)
    expect(lyricGlyphFrame(motion, 3, 3000).opacity).toBe(1)
  })

  it.each([80, 400, 600, 1000, 1800, 8000])(
    '%i 毫秒句子包含最后字素的错峰时间，至少保留 60%% 完整阅读',
    duration => {
      const text = '一'.repeat(120)
      const motion = plan(`[00:01]${text}`, 1000 + duration)
      expect(motion.enterMs + motion.exitMs).toBeLessThanOrEqual(
        duration * 0.4 + 0.001
      )
      const settled = 1000 + motion.enterMs + 1
      expect(lyricGlyphFrame(motion, 119, settled).opacity).toBe(1)
      if (duration < 450) {
        expect(motion.enterMs).toBe(0)
        expect(motion.exitMs).toBe(0)
        expect(lyricGlyphFrame(motion, 119, 1000).opacity).toBe(1)
      }
    }
  )

  it('普通 LRC 只有入场动画，不生成未经提供的演唱高亮', () => {
    const motion = plan()
    expect(motion.timings).toBeUndefined()
    expect(lyricGlyphFrame(motion, 0, 2000).fill).toBeUndefined()
  })

  it('真实词时间与入退场独立，未唱完的末词不被淡出', () => {
    const motion = plan('[00:01]<00:01>你<00:03>好<00:05>', 5000)
    expect(motion.exitMs).toBe(0)
    expect(lyricGlyphFrame(motion, 0, 2000).fill).toBe(0.5)
    expect(lyricGlyphFrame(motion, 1, 2000).fill).toBe(0)
    expect(lyricGlyphFrame(motion, 1, 4000).fill).toBe(0.5)
    expect(lyricGlyphFrame(motion, 1, 4999).opacity).toBe(1)
  })

  it('长空档不会拉长已有尾标签规定的扫色时间', () => {
    const motion = plan('[00:01]<00:01>光<00:02>', 9000)
    expect(lyricGlyphFrame(motion, 0, 2000).fill).toBe(1)
    expect(lyricGlyphFrame(motion, 0, 6000).fill).toBe(1)
    expect(motion.exitMs).toBeGreaterThan(0)
  })

  it('减少动态效果完整显示歌词，仍按真实进度更新词高亮', () => {
    const motion = plan('[00:01]<00:01>风<00:03>', 4000, 2)
    expect(lyricGlyphFrame(motion, 0, 2000, { x: 30, y: 20 }, true)).toEqual({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      clip: 0,
      fill: 0.5,
    })
    expect(lyricCameraFrame(motion, 2000, true)).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    })
  })

  it('标点没有演唱脉冲，持留镜头在边界回到静止姿态', () => {
    const motion = plan('[00:01]<00:01>，<00:03>', 5000, 2)
    expect(lyricGlyphFrame(motion, 0, 2000).scale).toBe(1)
    expect(lyricCameraFrame(motion, 1000)).toEqual({ x: 0, y: 0, scale: 1 })
    expect(lyricCameraFrame(motion, 5000).scale).toBeCloseTo(1)
    expect(lyricCameraFrame(motion, 3000).scale).toBeLessThanOrEqual(1.006)
  })
})
