import { describe, expect, it } from 'vitest'
import {
  buildLyricDisplayTokens,
  lyricTokenFrame,
  resolveSubtitleTracks,
} from './renderModel'
import { buildLyricShot } from '../visual/lyricStoryboard'
import type { LyricLine } from '../../types/music'

describe('富歌词渲染模型', () => {
  it('按音节真实时间和测量字宽扫光，Seek 无需重演历史帧', () => {
    const line: LyricLine = {
      id: 'line',
      startMs: 1000,
      endMs: 3000,
      text: 'AB',
      words: [
        {
          text: 'AB',
          startMs: 1000,
          endMs: 3000,
          syllables: [
            { text: 'A', startMs: 1000, endMs: 1500 },
            { text: 'B', startMs: 1500, endMs: 3000 },
          ],
        },
      ],
    }
    const token = buildLyricDisplayTokens(line, 3000)[0]!
    expect(token.timings).toEqual([
      { startMs: 1000, endMs: 1500 },
      { startMs: 1500, endMs: 3000 },
    ])
    const atBoundary = lyricTokenFrame(token, 1500, [0, 10, 100], 30, 3000)
    expect(atBoundary.fillPx).toBeCloseTo(11.35)
    lyricTokenFrame(token, 2900, [0, 10, 100], 30, 3000)
    expect(lyricTokenFrame(token, 1500, [0, 10, 100], 30, 3000)).toEqual(
      atBoundary
    )
    expect(lyricTokenFrame(token, 500, [0, 10, 100], 30, 3000).fillPx).toBe(0)
    expect(
      lyricTokenFrame(token, 3000, [0, 10, 100], 30, 3000, true)
    ).toMatchObject({ fillPx: 113.5, glow: 0, status: 'passed' })
  })
  it('显示空格、标点和 Unicode 字素；失配时间和普通歌词不生成扫光', () => {
    const line: LyricLine = {
      id: 'line',
      text: '你好， café 👨‍👩‍👧‍👦',
      startMs: 1000,
      words: [
        { text: '你好', startMs: 1000, endMs: 2000 },
        { text: 'café', startMs: 2000, endMs: 3000 },
      ],
    }
    const tokens = buildLyricDisplayTokens(line, 4000)
    expect(tokens.map(token => token.text).join('')).toBe(line.text)
    expect(tokens.filter(token => token.timed)).toHaveLength(2)
    expect(
      buildLyricDisplayTokens({ ...line, words: undefined }, 4000).every(
        token => !token.timed
      )
    ).toBe(true)
    expect(
      buildLyricDisplayTokens({ ...line, timing: 'line' }, 4000).every(
        token => !token.timed
      )
    ).toBe(true)
  })
  it('字幕模式的显示顺序与注音分组保持稳定', () => {
    const line: LyricLine = {
      id: 'ruby',
      text: '風吹',
      startMs: 1000,
      endMs: 3000,
      words: [
        {
          text: '風吹',
          startMs: 1000,
          endMs: 3000,
          syllables: [
            {
              text: '風吹',
              startMs: 1000,
              endMs: 3000,
              ruby: [{ text: 'かぜふ', startMs: 1000, endMs: 3000 }],
            },
          ],
        },
      ],
      translation: '风吹',
      romanization: 'kaze fu',
    }
    expect(
      resolveSubtitleTracks(line, 'both').map(track => track.role)
    ).toEqual(['romanization', 'translation'])
    expect(resolveSubtitleTracks(line, 'none')).toEqual([])
    const shot = buildLyricShot('manuscript', line.text, 'song', 0, 0, line)
    expect(shot.fragments[0]?.glyphs).toEqual(['風吹'])
    expect(shot.fragments[0]?.ruby).toEqual(['かぜふ'])
    expect(buildLyricDisplayTokens(line, 3000)[0]?.parts).toEqual([
      { text: '風吹', ruby: 'かぜふ' },
    ])
  })
})
