import type { LyricLine, SceneLayout } from '../../types/music'

export const sceneModes: { id: SceneLayout; name: string; description: string; number: string }[] = [
  { id: 'artistic', name: '流光', description: '错位歌词 · 光影舞台', number: '01' },
  { id: 'readable', name: '叙事', description: '逐行阅读 · 温柔留白', number: '02' },
  { id: 'title', name: '封面', description: '专辑封面 · 此刻正在听', number: '03' },
]

// 原创预览文案，仅用于展示排版，不模拟音频播放进度。
export const previewLyrics: LyricLine[] = [
  { id: 'preview-0', startMs: 0, text: '在声音里，遇见另一片风景' },
  { id: 'preview-1', startMs: 4000, text: '让每一句，都有自己的光' },
  { id: 'preview-2', startMs: 8000, text: '把这一刻，轻轻收藏' },
  { id: 'preview-3', startMs: 12000, text: '音乐还在，故事继续' },
]

export function lyricFragments(text: string): string[] {
  if (text.length > 80) return [text]
  const fragments = text.split(/(?<=[，。、,;!?！？])\s*|\s+(?=\S)/u).filter(Boolean)
  if (fragments.length > 1 && fragments.length <= 4) return fragments
  const characters = Array.from(text)
  if (characters.length > 9 && characters.length <= 24 && !/[a-z]/iu.test(text)) {
    const middle = Math.ceil(characters.length / 2)
    return [characters.slice(0, middle).join(''), characters.slice(middle).join('')]
  }
  return [text]
}
