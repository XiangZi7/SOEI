import { describe, expect, it } from 'vitest'
import { buildLyricShot, shotPalette, shotVariant } from './lyricStoryboard'
import { lyricGlyphs } from './lyricText'
import { lyricFragments } from './sceneModes'

describe('文字 PV 分镜', () => {
  it('暂停或回拖到同一句仍得到相同构图，连续六句轮换分镜', () => {
    const text = '听见风，也听见你'
    const before = buildLyricShot('montage', text, 'song-1', 3, 2)
    buildLyricShot('montage', '另一句', 'song-1', 4, 2)
    expect(buildLyricShot('montage', text, 'song-1', 3, 2)).toEqual(before)
    expect(
      new Set(
        Array.from({ length: 6 }, (_, index) => shotVariant('song-1', index, 2))
      ).size
    ).toBe(6)
    expect(shotVariant('song-1', 3, 3)).not.toBe(before.variant)
  })
  it('保留英文空格、组合音标和完整 emoji，不拆开字素', () => {
    const text = 'Hello, cafe\u0301 👨‍👩‍👧‍👦'
    const fragments = lyricFragments(text)
    expect(fragments.join('')).toBe(text)
    expect(lyricGlyphs('e\u0301👨‍👩‍👧‍👦')).toEqual(['e\u0301', '👨‍👩‍👧‍👦'])
    const shot = buildLyricShot('manuscript', text, 'song', 0)
    expect(shot.fragments.flatMap(fragment => fragment.glyphs).join('')).toBe(
      text
    )
  })
  it('英文不走竖排，长句使用紧凑完整文本并限制字素节点数', () => {
    const seed = Array.from({ length: 6 }, (_, seed) => seed).find(
      seed => shotVariant('song', 0, seed) === 1
    )!
    expect(
      buildLyricShot('montage', '写下此刻', 'song', 0, seed).vertical
    ).toBe(true)
    expect(
      buildLyricShot('montage', 'Stay with me', 'song', 0, seed).vertical
    ).toBe(false)
    const text = '此刻的声音'.repeat(100)
    const shot = buildLyricShot('montage', text, 'song', 0, seed)
    expect(shot.compact).toBe(true)
    expect(shot.vertical).toBe(false)
    expect(shot.fragments.flatMap(fragment => fragment.glyphs)).toEqual([text])
  })
  it('融合模式轮换配色，阅读模式维持稳定配色', () => {
    expect(shotPalette('montage', 0)).not.toEqual(shotPalette('montage', 1))
    expect(shotPalette('readable', 0)).toEqual(shotPalette('readable', 1))
  })
})
