import lyricText from '../../../public/demo/soei-test.lrc?raw'
import type { Track } from '../../types/music'

export const playbackTestLyrics = lyricText
export const playbackTestTrack: Track = {
  id: 'soei-playback-test',
  title: '光的回声 · 播放测试',
  artist: 'SOEI',
  album: '播放与歌词测试',
  localPath: '/demo/soei-test.wav',
  durationMs: 36000,
  coverRef: '/demo/soei-test-cover.svg',
  lyricRef: '/demo/soei-test.lrc',
  favorite: false,
  lastPlayed: null,
}
