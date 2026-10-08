import type { LyricLine, SceneLayout } from '../../types/music'
import { lyricGlyphs } from './lyricText'

export const sceneModes: {
  id: SceneLayout
  name: string
  description: string
  number: string
}[] = [
  {
    id: 'manuscript',
    name: '手书',
    description: '逐字成诗 · 线条随笔',
    number: '01',
  },
  {
    id: 'artistic',
    name: '流光',
    description: '错位歌词 · 光影舞台',
    number: '02',
  },
  {
    id: 'collage',
    name: '拼贴',
    description: '大小错落 · 色块分镜',
    number: '03',
  },
  {
    id: 'echo',
    name: '回响',
    description: '文字余韵 · 环形光影',
    number: '04',
  },
  {
    id: 'montage',
    name: '字幕',
    description: '自动分镜 · 字面构成',
    number: '05',
  },
  {
    id: 'readable',
    name: '叙事',
    description: '逐行阅读 · 温柔留白',
    number: '06',
  },
  {
    id: 'title',
    name: '封面',
    description: '专辑封面 · 此刻正在听',
    number: '07',
  },
]

// 原创分镜预览，与音频播放进度相互独立。
export const previewLyrics: LyricLine[] = [
  { id: 'preview-0', startMs: 0, text: '在声音里，遇见另一片风景' },
  { id: 'preview-1', startMs: 4000, text: '让每一句，都有自己的光' },
  { id: 'preview-2', startMs: 8000, text: '把这一刻，轻轻收藏' },
  { id: 'preview-3', startMs: 12000, text: '音乐还在，故事继续' },
  { id: 'preview-4', startMs: 16000, text: '一笔，一画，写下此刻' },
  { id: 'preview-5', startMs: 20000, text: '听见风，也听见你' },
]

export function lyricFragments(text: string): string[] {
  if (text.length > 80) return [text]
  const fragments = text
    .split(/(?<=[，。、,;!?！？])(?=\S)|(?<=\s)(?=\S)/u)
    .filter(Boolean)
  if (fragments.length > 4) return [text]
  if (fragments.length > 1 && fragments.length <= 4) return fragments
  const characters = lyricGlyphs(text)
  if (
    characters.length > 9 &&
    characters.length <= 24 &&
    !/[a-z]/iu.test(text)
  ) {
    const middle = Math.ceil(characters.length / 2)
    return [
      characters.slice(0, middle).join(''),
      characters.slice(middle).join(''),
    ]
  }
  return [text]
}
