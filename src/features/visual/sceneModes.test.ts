import { describe, expect, it } from 'vitest'
import { lyricFragments } from './sceneModes'

describe('歌词舞台分段', () => {
  it('保留中文标点与完整歌词内容', () => {
    const text = '让每一句，都有自己的光'
    expect(lyricFragments(text)).toEqual(['让每一句，', '都有自己的光'])
    expect(lyricFragments(text).join('')).toBe(text)
  })
  it('中文无标点歌词分行时不拆开 Unicode 字符', () => {
    const text = '把声音交给此刻让我们一起看见光🌙'
    expect(lyricFragments(text).join('')).toBe(text)
    expect(lyricFragments(text)).toHaveLength(2)
  })
  it('长句与过多分段使用完整行避免四层排版溢出', () => {
    const text = '第一句，第二句，第三句，第四句，第五句'
    expect(lyricFragments(text)).toEqual([text])
    const long = '这是很长的歌词'.repeat(20)
    expect(lyricFragments(long)).toEqual([long])
  })
})
