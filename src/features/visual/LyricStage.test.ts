import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import LyricStage from './LyricStage.vue'
import type { Track } from '../../types/music'

const track: Track = {
  id: 'real-song',
  localPath: 'song.wav',
  title: '夏天 烟火 我的尸体',
  artist: 'Seto',
  album: '专辑',
  durationMs: 254000,
  coverRef: null,
  lyricRef: null,
  favorite: false,
  lastPlayed: null,
}
async function render(
  lines: { id: string; startMs: number; text: string }[],
  index: number,
  demo = false
) {
  return renderToString(
    createSSRApp({
      render: () =>
        h(LyricStage, {
          track: { ...track, demo },
          lines,
          index,
          layout: 'title',
          seed: 0,
          animated: false,
          reducedMotion: true,
          showcase: true,
        }),
    })
  )
}

describe('封面舞台始终显示对应歌曲', () => {
  it('歌曲没有歌词时仍显示当前封面、歌名和歌手', async () => {
    const html = await render([], -1)
    expect(html).toContain('cover-composition')
    expect(html).toContain(track.title)
    expect(html).toContain(track.artist)
    expect(html).toContain('此刻正在听')
    expect(html).not.toContain('Purity')
  })
  it('前奏期间保持封面布局，歌词开始后显示同步内容', async () => {
    const lines = [{ id: 'line', startMs: 5000, text: '真正的歌词' }]
    const intro = await render(lines, -1)
    expect(intro).toContain('cover-composition')
    expect(intro).not.toContain('真正的歌词')
    const playing = await render(lines, 0)
    expect(playing).toContain('真正的歌词')
    expect(playing).toContain(track.title)
  })
  it('示例封面明确标记视觉预览', async () => {
    const html = await render([], -1, true)
    expect(html).toContain('视觉预览')
    expect(html).not.toContain('此刻正在听')
  })
})
