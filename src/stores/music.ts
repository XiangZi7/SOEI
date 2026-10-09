import { computed, reactive, toRefs, watch } from 'vue'
import { defineStore } from 'pinia'
import { call, desktop, errorMessage, onNative } from '../bridge/native'
import { demoTracks } from '../features/library/demo'
import { parseLrc } from '../features/lyrics/lrc'
import {
  playbackTestLyrics,
  playbackTestTrack,
} from '../features/player/testTrack'
import type {
  Display,
  LibraryTab,
  PlaybackSnapshot,
  Preferences,
  ScanProgress,
  Track,
  WallpaperStatus,
} from '../types/music'

export const defaultPreferences: Preferences = {
  showTitles: false,
  reducedMotion: false,
  layout: 'manuscript',
  sceneSeed: 0,
  lyricSize: 42,
  lyricOffset: 0,
  quality: 'balanced',
  closeToTray: false,
  background: '',
  language: 'zh-CN',
  playlists: [],
  queue: [],
  trackOffsets: {},
  trackBackgrounds: {},
}
const emptySnapshot = (): PlaybackSnapshot => ({
  sessionId: 0,
  revision: 0,
  trackId: null,
  status: 'stopped',
  positionMs: 0,
  durationMs: 0,
  volume: 0.65,
  repeatMode: 'sequential',
  queue: [],
  energy: [0, 0, 0, 0],
  error: null,
})

export const useMusicStore = defineStore('music', () => {
  // 响应式状态
  const state = reactive({
    // 已导入的真实歌曲
    realTracks: [] as Track[],
    // 样例封面仅用于视觉预览
    demos: demoTracks.map(track => ({ ...track })),
    // 原生确认的播放状态
    snapshot: emptySnapshot(),
    // 当前预览的样例
    previewId: 'demo-7',
    // 导航分类
    tab: 'all' as LibraryTab,
    // 搜索关键词
    query: '',
    // 收藏筛选
    favoritesOnly: false,
    // 最近播放筛选
    recentOnly: false,
    // 持久化用户配置
    preferences: { ...defaultPreferences } as Preferences,
    // 歌词文本
    lyricText: '',
    // 导入进度
    scan: {
      running: false,
      scanned: 0,
      imported: 0,
      errors: [],
      cancelled: false,
    } as ScanProgress,
    // 可用显示器
    displays: [] as Display[],
    // 壁纸状态
    wallpaper: { enabled: [], error: null } as WallpaperStatus,
    // 操作错误提示
    error: '',
    // 操作反馈
    notice: '',
    // 初始加载状态
    ready: false,
  })
  const tracks = computed(() =>
    state.realTracks.length ? state.realTracks : state.demos
  )
  const filteredTracks = computed(() => {
    const query = state.query.trim().toLocaleLowerCase()
    return tracks.value.filter(
      track =>
        (!state.favoritesOnly || track.favorite) &&
        (!state.recentOnly || track.lastPlayed) &&
        (!query ||
          `${track.title} ${track.artist} ${track.album}`
            .toLocaleLowerCase()
            .includes(query))
    )
  })
  const activeTrack = computed(
    () =>
      state.realTracks.find(track => track.id === state.snapshot.trackId) ??
      null
  )
  const previewTrack = computed(
    () =>
      state.demos.find(track => track.id === state.previewId) ?? state.demos[7]!
  )
  const lyrics = computed(() => parseLrc(state.lyricText))
  const queueTracks = computed(() =>
    state.snapshot.queue
      .map(id => state.realTracks.find(track => track.id === id))
      .filter((track): track is Track => !!track)
  )
  const audio = desktop ? null : new Audio()
  const cleanups: (() => void)[] = []
  const objectUrls: string[] = []
  const browserLyrics = new Map<string, string>()
  const browserSidecars = new Map<string, { text: string; name: string }>()
  let lyricRequest = 0
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let lastSaved = ''
  let playRequest = 0
  let pendingSave: Promise<boolean> | null = null

  function upsert(track: Track) {
    const index = state.realTracks.findIndex(item => item.id === track.id)
    if (index === -1) state.realTracks.push(track)
    else state.realTracks[index] = track
  }
  function acceptSnapshot(snapshot: PlaybackSnapshot) {
    if (snapshot.revision >= state.snapshot.revision) {
      state.snapshot = snapshot
    }
  }
  function report(error: unknown) {
    state.error = errorMessage(error)
  }
  async function initialize(mode: 'main' | 'wallpaper' | 'settings' = 'main') {
    if (state.ready) return
    try {
      if (desktop) {
        cleanups.push(
          await onNative<PlaybackSnapshot>('player:state', acceptSnapshot)
        )
        cleanups.push(
          await onNative<Preferences>('settings:changed', preferences => {
            const incoming = { ...defaultPreferences, ...preferences }
            const serialized = JSON.stringify(incoming)
            // 合并其他窗口的更新，保留尚未保存的本地修改。
            if (state.ready && lastSaved) {
              const baseline = JSON.parse(lastSaved) as Preferences
              for (const key of Object.keys(
                incoming
              ) as (keyof Preferences)[]) {
                if (
                  JSON.stringify(state.preferences[key]) !==
                  JSON.stringify(baseline[key])
                ) {
                  Object.assign(incoming, { [key]: state.preferences[key] })
                }
              }
            }
            lastSaved = serialized
            state.preferences = incoming
          })
        )
        cleanups.push(
          await onNative<WallpaperStatus>('wallpaper:status', status => {
            state.wallpaper = status
          })
        )
        if (mode !== 'wallpaper') {
          cleanups.push(
            await onNative<Track>('library:track', track => {
              upsert(track)
              if (track.id === state.snapshot.trackId) void loadLyrics(track.id)
            })
          )
          cleanups.push(
            await onNative<ScanProgress>('library:scan-progress', progress => {
              state.scan = progress
              if (!progress.running)
                state.notice = `已索引 ${progress.imported} 首音乐${progress.cancelled ? ' · 扫描已取消' : ''}${progress.errors.length ? ` · ${progress.errors.length} 个文件未导入` : ''}`
            })
          )
          cleanups.push(await onNative<string>('app:error', report))
          state.realTracks = await call<Track[]>('library_load')
        }
        const preferences = await call<Partial<Preferences>>('settings_load')
        state.preferences = { ...defaultPreferences, ...preferences }
        acceptSnapshot(await call<PlaybackSnapshot>('player_snapshot'))
        state.wallpaper = await call<WallpaperStatus>('wallpaper_status')
        if (mode === 'main' && state.preferences.queue.length)
          await command('queue', {
            queue: state.preferences.queue.filter(id =>
              state.realTracks.some(track => track.id === id)
            ),
          })
      } else {
        try {
          state.preferences = {
            ...defaultPreferences,
            ...JSON.parse(localStorage.getItem('soei-preferences') ?? '{}'),
          }
          const favorites: string[] = JSON.parse(
            localStorage.getItem('soei-demo-favorites') ?? '[]'
          )
          state.demos.forEach(track => {
            track.favorite = favorites.includes(track.id)
          })
        } catch {
          state.notice = '已恢复默认设置'
        }
      }
      lastSaved = JSON.stringify(state.preferences)
    } catch (error) {
      report(error)
    }
    state.ready = true
  }
  async function loadLyrics(id: string | null) {
    const request = ++lyricRequest
    state.lyricText = ''
    if (!id) return
    try {
      if (desktop) {
        const [track, text] = await call<[Track, string | null]>(
          'scene_track',
          { id }
        )
        if (request !== lyricRequest) return
        upsert(track)
        state.lyricText = text ?? ''
      } else state.lyricText = browserLyrics.get(id) ?? ''
    } catch (error) {
      if (request === lyricRequest) report(error)
    }
  }
  cleanups.push(watch(() => state.snapshot.trackId, loadLyrics))
  cleanups.push(
    watch(
      () => state.preferences,
      () => {
        if (!state.ready) return
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          void flushPreferences()
        }, 250)
      },
      { deep: true }
    )
  )

  async function flushPreferences(): Promise<boolean> {
    clearTimeout(saveTimer)
    if (!state.ready) return true
    if (pendingSave) {
      if (!(await pendingSave)) return false
      return flushPreferences()
    }
    const serialized = JSON.stringify(state.preferences)
    if (serialized === lastSaved) return true
    pendingSave = (async () => {
      try {
        if (desktop)
          await call('settings_save', { value: JSON.parse(serialized) })
        else localStorage.setItem('soei-preferences', serialized)
        lastSaved = serialized
        return true
      } catch (error) {
        report(error)
        return false
      }
    })()
    try {
      return await pendingSave
    } finally {
      pendingSave = null
    }
  }

  if (audio) {
    const events: (keyof HTMLMediaElementEventMap)[] = [
      'timeupdate',
      'loadedmetadata',
      'play',
      'pause',
      'ended',
      'error',
    ]
    const update = (event: Event) => {
      state.snapshot.positionMs = Math.round(audio.currentTime * 1000)
      state.snapshot.durationMs = Number.isFinite(audio.duration)
        ? Math.round(audio.duration * 1000)
        : 0
      state.snapshot.status = audio.paused ? 'paused' : 'playing'
      if (event.type === 'error') {
        state.snapshot.status = 'stopped'
        state.error = '无法解码这个音频文件，请尝试其他文件'
      }
      if (event.type === 'ended') {
        if (state.snapshot.repeatMode === 'one') {
          audio.currentTime = 0
          void audio.play().catch(report)
        } else void command('next')
      }
    }
    events.forEach(event => audio.addEventListener(event, update))
    cleanups.push(() =>
      events.forEach(event => audio.removeEventListener(event, update))
    )
  }
  async function command(
    action: string,
    args: Record<string, unknown> = {}
  ): Promise<boolean> {
    try {
      if (desktop) {
        acceptSnapshot(
          await call<PlaybackSnapshot>('player_command', { action, ...args })
        )
        return true
      }
      if (!audio) return false
      if (action === 'play') {
        const track = state.realTracks.find(track => track.id === args.id)
        if (!track) return false
        const request = ++playRequest
        audio.src = track.localPath
        audio.volume = state.snapshot.volume
        await audio.play()
        if (request !== playRequest) return false
        state.snapshot.trackId = track.id
        state.snapshot.sessionId += 1
        state.snapshot.positionMs = Math.round(audio.currentTime * 1000)
        state.snapshot.durationMs = Number.isFinite(audio.duration)
          ? Math.round(audio.duration * 1000)
          : track.durationMs
        state.snapshot.status = audio.paused ? 'paused' : 'playing'
        track.lastPlayed = Date.now() / 1000
      } else if (action === 'toggle') {
        if (!state.snapshot.trackId) return false
        if (audio.paused) await audio.play()
        else audio.pause()
      } else if (action === 'volume') {
        state.snapshot.volume = Math.max(0, Math.min(1, Number(args.value)))
        audio.volume = state.snapshot.volume
      } else if (action === 'seek') {
        if (!Number.isFinite(audio.duration)) return false
        audio.currentTime = Math.min(
          audio.duration,
          Math.max(0, Number(args.value) / 1000)
        )
        state.snapshot.positionMs = Math.round(audio.currentTime * 1000)
      } else if (action === 'repeat')
        state.snapshot.repeatMode = String(args.mode)
      else if (action === 'queue') {
        state.snapshot.queue = args.queue as string[]
        if (!state.snapshot.queue.length) await command('stop')
      } else if (action === 'stop') {
        audio.pause()
        audio.currentTime = 0
        state.snapshot.status = 'stopped'
      } else if (action === 'next' || action === 'previous') {
        const queue = state.snapshot.queue
        const index = queue.indexOf(state.snapshot.trackId ?? '')
        const next = action === 'next' ? index + 1 : Math.max(0, index - 1)
        if (queue[next]) await command('play', { id: queue[next] })
        else if (state.snapshot.repeatMode === 'repeat' && queue[0])
          await command('play', { id: queue[0] })
        else {
          audio.pause()
          state.snapshot.status = 'stopped'
        }
      }
      return true
    } catch (error) {
      report(error)
      return false
    }
  }
  async function select(track: Track) {
    state.error = ''
    if (track.demo) {
      state.previewId = track.id
      return
    }
    if (!state.snapshot.queue.includes(track.id))
      await setQueue(state.realTracks.map(track => track.id))
    await command('play', { id: track.id })
  }
  async function setQueue(ids: string[]) {
    await command('queue', { queue: ids })
    state.preferences.queue = ids
  }
  async function preparePlaybackTest(): Promise<Track | null> {
    state.error = ''
    try {
      if (desktop) {
        const track = await call<Track>('library_test_track')
        upsert(track)
        if (state.snapshot.trackId === track.id) await loadLyrics(track.id)
        return track
      }
      const existing = state.realTracks.find(
        track => track.id === playbackTestTrack.id
      )
      const track = existing ?? { ...playbackTestTrack }
      upsert(track)
      attachBrowserLyrics(
        track.id,
        playbackTestLyrics,
        playbackTestTrack.lyricRef!
      )
      return track
    } catch (error) {
      report(error)
      return null
    }
  }
  async function favorite(track: Track) {
    try {
      if (track.demo) {
        track.favorite = !track.favorite
        localStorage.setItem(
          'soei-demo-favorites',
          JSON.stringify(
            state.demos.filter(track => track.favorite).map(track => track.id)
          )
        )
      } else if (desktop)
        upsert(await call<Track>('library_favorite', { id: track.id }))
      else track.favorite = !track.favorite
    } catch (error) {
      report(error)
    }
  }
  async function importMusic(directory = false) {
    try {
      state.scan.running = true
      const started = await call<boolean>('library_import', { directory })
      if (!started) state.scan.running = false
    } catch (error) {
      state.scan.running = false
      report(error)
    }
  }
  function sidecarKey(name: string) {
    return name
      .replace(/\.[^.]+$/, '')
      .normalize('NFC')
      .toLocaleLowerCase()
  }
  function attachBrowserLyrics(id: string, text: string, name: string) {
    browserLyrics.set(id, text)
    const track = state.realTracks.find(track => track.id === id)
    if (track) track.lyricRef = name
    if (state.snapshot.trackId === id) {
      ++lyricRequest
      state.lyricText = text
    }
  }
  async function importBrowserFiles(files: FileList | null) {
    if (!files) return
    const selected = Array.from(files)
    for (const file of selected.filter(file => /\.lrc$/i.test(file.name))) {
      const text = await file.text()
      browserSidecars.set(sidecarKey(file.name), { text, name: file.name })
    }
    for (const file of selected) {
      if (!/\.(mp3|flac|wav|ogg|m4a|aac)$/i.test(file.name)) continue
      const id = `${file.name}:${file.size}:${file.lastModified}`
      if (state.realTracks.some(track => track.id === id)) continue
      const url = URL.createObjectURL(file)
      objectUrls.push(url)
      state.realTracks.push({
        id,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: '未知歌手',
        album: '本地音乐',
        localPath: url,
        durationMs: 0,
        coverRef: null,
        lyricRef: null,
        favorite: false,
        lastPlayed: null,
      })
    }
    for (const track of state.realTracks) {
      const sidecar = browserSidecars.get(
        track.title.normalize('NFC').toLocaleLowerCase()
      )
      if (sidecar) attachBrowserLyrics(track.id, sidecar.text, sidecar.name)
    }
    state.notice = '音乐与同名歌词已导入本次预览'
  }
  async function importBrowserLyrics(file: File, id: string) {
    const text = await file.text()
    attachBrowserLyrics(id, text, file.name)
    state.notice = `已导入 ${parseLrc(text).length} 句歌词`
  }
  async function importLyrics() {
    const id = activeTrack.value?.id
    if (!id) return
    try {
      const text = await call<string | null>('lyrics_import', { id })
      if (text !== null) {
        if (state.snapshot.trackId === id) {
          ++lyricRequest
          state.lyricText = text
        }
        state.notice = `已导入 ${parseLrc(text).length} 句歌词`
      }
    } catch (error) {
      report(error)
    }
  }
  async function refreshDisplays() {
    if (!desktop) {
      state.notice = '在 SOEI 桌面窗口中可以设置桌面壁纸'
      return
    }
    try {
      state.displays = await call<Display[]>('display_list')
    } catch (error) {
      report(error)
    }
  }
  async function setWallpaper(ids: string[]) {
    try {
      state.wallpaper = await call<WallpaperStatus>('wallpaper_set_enabled', {
        ids,
      })
    } catch (error) {
      report(error)
    }
  }
  async function chooseBackground() {
    try {
      const background = await call<string | null>('visual_import')
      if (background) state.preferences.background = background
    } catch (error) {
      report(error)
    }
  }
  function createPlaylist(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    state.preferences.playlists.push({
      id: crypto.randomUUID(),
      name: trimmed,
      trackIds: [],
    })
  }
  function dispose() {
    cleanups.forEach(cleanup => cleanup())
    clearTimeout(saveTimer)
    void flushPreferences()
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    objectUrls.forEach(url => URL.revokeObjectURL(url))
  }
  return {
    ...toRefs(state),
    tracks,
    filteredTracks,
    activeTrack,
    previewTrack,
    lyrics,
    queueTracks,
    initialize,
    flushPreferences,
    select,
    command,
    setQueue,
    preparePlaybackTest,
    favorite,
    importMusic,
    importBrowserFiles,
    importBrowserLyrics,
    importLyrics,
    refreshDisplays,
    setWallpaper,
    chooseBackground,
    createPlaylist,
    report,
    dispose,
  }
})
