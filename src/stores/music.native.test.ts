import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useMusicStore } from './music'
import type { Track } from '../types/music'

const native = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => void>(),
  call: vi.fn(),
}))
vi.mock('../bridge/native', () => ({
  desktop: true,
  call: native.call,
  onNative: vi.fn(
    async (event: string, handler: (payload: unknown) => void) => {
      native.handlers.set(event, handler)
      return () => native.handlers.delete(event)
    }
  ),
  errorMessage: (error: unknown) => String(error),
}))

const track: Track = {
  id: 'current',
  localPath: 'song.wav',
  title: '当前播放的歌',
  artist: 'Seto',
  album: '专辑',
  durationMs: 180000,
  coverRef: null,
  lyricRef: null,
  favorite: false,
  lastPlayed: null,
}

describe('设置子窗口与主窗口共享状态', () => {
  let store: ReturnType<typeof useMusicStore>
  beforeEach(() => {
    vi.useFakeTimers()
    native.call.mockReset()
    native.handlers.clear()
    native.call.mockImplementation(async (command: string) => {
      switch (command) {
        case 'library_load':
          return [{ ...track }]
        case 'settings_load':
          return { queue: [track.id] }
        case 'player_command':
        case 'player_snapshot':
          return {
            sessionId: 1,
            revision: 1,
            trackId: track.id,
            status: 'paused',
            positionMs: 30000,
            durationMs: 180000,
            volume: 0.65,
            repeatMode: 'sequential',
            queue: [track.id],
            energy: [],
            error: null,
          }
        case 'scene_track':
          return [{ ...track }, '[00:00]当前歌曲的歌词']
        case 'wallpaper_status':
          return { enabled: [], error: null }
      }
    })
    setActivePinia(createPinia())
    store = useMusicStore()
  })
  afterEach(async () => {
    await store.flushPreferences()
    store.dispose()
    store.$dispose()
    vi.useRealTimers()
  })

  it('打开设置会读取当前歌曲和歌词，并保持播放队列及进度', async () => {
    await store.initialize('settings')
    await nextTick()
    expect(store.activeTrack?.title).toBe(track.title)
    expect(store.lyrics[0]?.text).toBe('当前歌曲的歌词')
    expect(store.snapshot.positionMs).toBe(30000)
    expect(
      native.call.mock.calls.some(([name]) => name === 'player_command')
    ).toBe(false)
  })

  it('主窗口仍会恢复保存的队列，壁纸窗口仅订阅读取状态', async () => {
    await store.initialize()
    expect(native.call).toHaveBeenCalledWith('player_command', {
      action: 'queue',
      queue: [track.id],
    })
    store.dispose()
    store.$dispose()
    setActivePinia(createPinia())
    store = useMusicStore()
    native.call.mockClear()
    await store.initialize('wallpaper')
    expect(
      native.call.mock.calls.some(
        ([name]) => name === 'library_load' || name === 'player_command'
      )
    ).toBe(false)
  })

  it('关闭前立即保存最新修改，无需等待自动保存的延迟', async () => {
    await store.initialize('settings')
    store.preferences.showTitles = true
    await nextTick()
    expect(await store.flushPreferences()).toBe(true)
    expect(native.call).toHaveBeenCalledWith('settings_save', {
      value: expect.objectContaining({ showTitles: true }),
    })
    await vi.advanceTimersByTimeAsync(300)
    expect(
      native.call.mock.calls.filter(([name]) => name === 'settings_save')
    ).toHaveLength(1)
  })

  it('来自另一个窗口的配置立即同步，不会回写造成循环', async () => {
    await store.initialize('settings')
    native.handlers.get('settings:changed')?.({
      ...store.preferences,
      layout: 'title',
    })
    expect(store.preferences.layout).toBe('title')
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(
      native.call.mock.calls.some(([name]) => name === 'settings_save')
    ).toBe(false)
  })

  it('同步其他窗口配置时保留尚未保存的本地编辑', async () => {
    await store.initialize('settings')
    const saved = JSON.parse(JSON.stringify(store.preferences))
    store.preferences.showTitles = true
    native.handlers.get('settings:changed')?.({ ...saved, quality: 'power' })
    expect(store.preferences.showTitles).toBe(true)
    expect(store.preferences.quality).toBe('power')
    await nextTick()
    expect(await store.flushPreferences()).toBe(true)
    expect(native.call).toHaveBeenCalledWith('settings_save', {
      value: expect.objectContaining({ showTitles: true, quality: 'power' }),
    })
  })

  it('自动保存进行中关闭窗口时，会继续保存之后的编辑', async () => {
    await store.initialize('settings')
    let finish!: () => void
    native.call.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve
        })
    )
    store.preferences.showTitles = true
    const first = store.flushPreferences()
    store.preferences.layout = 'title'
    await nextTick()
    const closing = store.flushPreferences()
    finish()
    expect(await first).toBe(true)
    expect(await closing).toBe(true)
    const saves = native.call.mock.calls.filter(
      ([name]) => name === 'settings_save'
    )
    expect(saves).toHaveLength(2)
    expect(saves[1]?.[1]).toEqual({
      value: expect.objectContaining({ showTitles: true, layout: 'title' }),
    })
  })

  it('另一窗口为当前歌曲导入歌词后，立即重新加载该歌曲歌词', async () => {
    await store.initialize('settings')
    await nextTick()
    native.call.mockResolvedValueOnce([
      { ...track, lyricRef: 'new.lrc' },
      '[00:00]新的歌词',
    ])
    native.handlers.get('library:track')?.({ ...track, lyricRef: 'new.lrc' })
    await nextTick()
    expect(store.lyrics[0]?.text).toBe('新的歌词')
    expect(store.activeTrack?.lyricRef).toBe('new.lrc')
  })

  it('导入歌词期间切歌，导入结果不会覆盖新歌曲的歌词', async () => {
    await store.initialize('settings')
    await nextTick()
    let finishImport!: (text: string | null) => void
    native.call.mockImplementationOnce(
      () =>
        new Promise<string | null>(resolve => {
          finishImport = resolve
        })
    )
    const importing = store.importLyrics()
    expect(native.call).toHaveBeenLastCalledWith('lyrics_import', {
      id: track.id,
    })

    const nextTrack = { ...track, id: 'next', title: '下一首歌' }
    native.call.mockResolvedValueOnce([nextTrack, '[00:00]下一首歌的歌词'])
    native.handlers.get('player:state')?.({
      ...store.snapshot,
      revision: 2,
      sessionId: 2,
      trackId: nextTrack.id,
      positionMs: 0,
    })
    await nextTick()
    expect(store.lyrics[0]?.text).toBe('下一首歌的歌词')

    finishImport('[00:00]原歌曲新导入的歌词')
    await importing
    expect(store.activeTrack?.id).toBe(nextTrack.id)
    expect(store.lyrics[0]?.text).toBe('下一首歌的歌词')
  })

  it('成功导入歌词后，较早发起的后台读取不会覆盖新歌词', async () => {
    await store.initialize('settings')
    await nextTick()
    let finishLoad!: (value: [Track, string | null]) => void
    native.call.mockImplementationOnce(
      () =>
        new Promise<[Track, string | null]>(resolve => {
          finishLoad = resolve
        })
    )
    native.handlers.get('library:track')?.({ ...track, lyricRef: 'old.lrc' })

    native.call.mockResolvedValueOnce('[00:00]新导入的歌词')
    await store.importLyrics()
    expect(store.lyrics[0]?.text).toBe('新导入的歌词')

    finishLoad([{ ...track, lyricRef: 'old.lrc' }, '[00:00]较早读取的歌词'])
    await nextTick()
    expect(store.lyrics[0]?.text).toBe('新导入的歌词')
  })

  it('保存失败会返回失败并保留修改，允许用户重试关闭', async () => {
    await store.initialize('settings')
    store.preferences.showTitles = true
    await nextTick()
    native.call.mockRejectedValueOnce(new Error('保存失败'))
    expect(await store.flushPreferences()).toBe(false)
    expect(store.error).toContain('保存失败')
    expect(store.preferences.showTitles).toBe(true)
    expect(await store.flushPreferences()).toBe(true)
  })
})
