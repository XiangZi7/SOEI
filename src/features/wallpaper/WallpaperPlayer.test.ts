import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMusicStore } from '../../stores/music'
import WallpaperPlayer from './WallpaperPlayer.vue'
import { playbackTestTrack } from '../player/testTrack'

vi.mock('../../bridge/native', () => ({
  desktop: true,
  call: vi.fn(async () => [{ ...playbackTestTrack }, null]),
  onNative: vi.fn(),
  assetUrl: (path: string) => path,
  errorMessage: String,
}))

describe('壁纸播放器同步真实歌曲', () => {
  let store: ReturnType<typeof useMusicStore>
  beforeEach(async () => {
    setActivePinia(createPinia())
    store = useMusicStore()
    store.realTracks = [{ ...playbackTestTrack }]
    store.snapshot.trackId = playbackTestTrack.id
    store.snapshot.durationMs = 36000
    store.snapshot.status = 'paused'
    await nextTick()
    await Promise.resolve()
    store.lyricText = '[00:05]第一句\n[00:10]第二句\n[00:15]第三句'
  })
  afterEach(() => {
    store.dispose()
    store.$dispose()
  })
  const render = () =>
    renderToString(createSSRApp({ render: () => h(WallpaperPlayer) }))

  it('手书模式下也显示双栏播放器与真实播放时间，不修改桌面场景', async () => {
    store.preferences.layout = 'manuscript'
    store.snapshot.positionMs = 6000
    const html = await render()
    expect(html).toContain('cover-composition compact')
    expect(html).toContain(playbackTestTrack.title)
    expect(html).toContain('0:06 / 0:36')
    expect(html).toMatch(/cover-current[^>]*>第一句/)
    expect(store.preferences.layout).toBe('manuscript')
    expect(html).toContain('停用壁纸并返回音乐空间')
  })

  it('全局与歌曲偏移一起控制歌词，暂停和拖回前奏时内容正确', async () => {
    store.snapshot.positionMs = 8000
    store.preferences.lyricOffset = 1000
    store.preferences.trackOffsets[playbackTestTrack.id] = 1000
    expect(await render()).toMatch(/cover-current[^>]*>第二句/)
    store.snapshot.positionMs = 0
    expect(await render()).toContain('前奏 · 故事即将开始')
    store.lyricText = ''
    expect(await render()).toContain('暂无歌词')
  })
})
