import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useMusicStore } from './music'
import { lyricIndexAt } from '../features/lyrics/lrc'

vi.mock('../bridge/native', () => ({
  desktop: false,
  call: vi.fn(),
  onNative: vi.fn(),
  errorMessage: (error: unknown) => String(error),
}))

class TestAudio extends EventTarget {
  static latest: TestAudio
  private source = ''
  currentTime = 0
  duration = 36
  volume = 1
  paused = true

  constructor() {
    super()
    TestAudio.latest = this
  }
  get src() {
    return this.source
  }
  set src(value: string) {
    this.source = value
    this.currentTime = 0
    this.paused = true
  }
  async play() {
    this.paused = false
    this.dispatchEvent(new Event('play'))
  }
  pause() {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }
  advance(seconds: number) {
    if (!this.paused) this.currentTime += seconds
    this.dispatchEvent(new Event('timeupdate'))
  }
}

function files(...items: File[]): FileList {
  return items as unknown as FileList
}

describe('真实播放状态与每首歌曲的歌词', () => {
  let store: ReturnType<typeof useMusicStore>
  beforeEach(() => {
    vi.stubGlobal('Audio', TestAudio)
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
    setActivePinia(createPinia())
    store = useMusicStore()
  })
  afterEach(() => {
    store.dispose()
    store.$dispose()
    vi.unstubAllGlobals()
  })

  async function playTest() {
    const track = await store.preparePlaybackTest()
    expect(track).not.toBeNull()
    await store.select(track!)
    await nextTick()
    return track!
  }
  function currentLine() {
    return store.lyrics[lyricIndexAt(store.lyrics, store.snapshot.positionMs)]
      ?.text
  }

  it('内置测试使用实际音频源，播放时间驱动对应的歌词', async () => {
    const track = await playTest()
    expect(TestAudio.latest.src).toBe('/demo/soei-test.wav')
    expect(store.activeTrack?.id).toBe(track.id)
    expect(store.snapshot.status).toBe('playing')
    expect(store.snapshot.durationMs).toBe(36000)
    expect(store.lyrics).toHaveLength(9)
    expect(currentLine()).toBe('把声音交给此刻')
    TestAudio.latest.advance(8.5)
    expect(currentLine()).toBe('一束光落在安静角落')
  })

  it('暂停冻结歌词；暂停时向前和向后拖动仍会立即定位', async () => {
    await playTest()
    TestAudio.latest.advance(5)
    await store.command('toggle')
    TestAudio.latest.advance(10)
    expect(store.snapshot.status).toBe('paused')
    expect(store.snapshot.positionMs).toBe(5000)
    expect(currentLine()).toBe('让窗外的风慢慢经过')
    await store.command('seek', { value: 24500 })
    expect(currentLine()).toBe('拖动进度，找到这一句')
    await store.command('seek', { value: 1000 })
    expect(currentLine()).toBe('把声音交给此刻')
    await store.command('toggle')
    TestAudio.latest.advance(4)
    expect(store.snapshot.status).toBe('playing')
    expect(currentLine()).toBe('让窗外的风慢慢经过')
  })

  it('重复测试不会重复添加歌曲，并保留收藏', async () => {
    const track = await playTest()
    await store.favorite(store.activeTrack!)
    await store.preparePlaybackTest()
    expect(store.realTracks).toHaveLength(1)
    expect(store.activeTrack?.favorite).toBe(true)
    expect(store.snapshot.queue).toEqual([track.id])
  })

  it('为测试曲导入自定义歌词后，重新测试会恢复内置同步歌词', async () => {
    const track = await playTest()
    await store.importBrowserLyrics(
      new File(['[00:00]替换歌词'], 'custom.lrc'),
      track.id
    )
    expect(currentLine()).toBe('替换歌词')
    await store.preparePlaybackTest()
    expect(store.lyrics).toHaveLength(9)
    expect(currentLine()).toBe('把声音交给此刻')
  })

  it('音频与同名 LRC 同时导入，切歌后恢复各自歌词', async () => {
    await store.importBrowserFiles(
      files(
        new File(['audio-a'], '星光.wav'),
        new File(['audio-b'], 'Moon.wav'),
        new File(['[00:00]星光的歌词'], '星光.lrc'),
        new File(['[00:00]Moon lyrics'], 'moon.LRC')
      )
    )
    const [first, second] = store.realTracks
    await store.select(first!)
    await nextTick()
    expect(currentLine()).toBe('星光的歌词')
    await store.select(second!)
    await nextTick()
    expect(currentLine()).toBe('Moon lyrics')
    await store.select(first!)
    await nextTick()
    expect(currentLine()).toBe('星光的歌词')
  })

  it('先导入音频、后补同名 LRC 时，当前歌曲立即显示歌词', async () => {
    await store.importBrowserFiles(files(new File(['audio'], '补充.wav')))
    await store.select(store.realTracks[0]!)
    await nextTick()
    expect(store.lyrics).toEqual([])
    await store.importBrowserFiles(
      files(new File(['[00:00]补充歌词'], '补充.lrc'))
    )
    expect(currentLine()).toBe('补充歌词')
  })

  it('单独导入的歌词绑定原歌曲，读取期间切歌不会覆盖新歌曲', async () => {
    const testTrack = await playTest()
    await store.importBrowserFiles(files(new File(['audio'], '另一首.wav')))
    const other = store.realTracks.find(track => track.id !== testTrack.id)!
    let finish!: (text: string) => void
    const lyricFile = new File([], 'custom.lrc')
    vi.spyOn(lyricFile, 'text').mockReturnValue(
      new Promise(resolve => {
        finish = resolve
      })
    )
    const importing = store.importBrowserLyrics(lyricFile, testTrack.id)
    await store.select(other)
    await nextTick()
    finish('[00:00]自定义歌词')
    await importing
    expect(store.lyrics).toEqual([])
    await store.select(testTrack)
    await nextTick()
    expect(currentLine()).toBe('自定义歌词')
  })
})
