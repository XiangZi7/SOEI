import type { ArtworkCrop, Track } from '../../types/music'

// 直接从用户参考图的封面区域取景，避免重新绘制造成画面偏差。
function art(x: number, y: number, width = 69, height = 75): ArtworkCrop {
  return {
    source: '/art/scenes.png',
    x,
    y,
    width,
    height,
    sourceWidth: 1024,
    sourceHeight: 1024,
  }
}
const items: [number, string, string, string, ArtworkCrop, string][] = [
  [0, '白い風', '藍月なくる', 'Petals', art(29, 105), '#a4aaa5'],
  [7, 'Purity', '藍月なくる', 'Petals', art(80, 770, 107, 108), '#9bafae'],
  [9, 'Midnight', 'よるのうた', 'Moonlit', art(192, 105), '#4c6477'],
  [1, '白い記憶', '藍月なくる', 'Petals', art(272, 105), '#b1b7ae'],
  [4, '月の祈り', 'Silent Universe', 'Moonlit', art(352, 105), '#8c9187'],
  [3, 'Blue Hour', 'Haruka', 'Moonlit', art(432, 105), '#526779'],
  [6, '静かな夜', 'よるのうた', 'Moonlit', art(29, 191), '#454e52'],
  [5, '風の記憶', 'Sora', 'Petals', art(111, 205, 67, 59), '#a6a99c'],
  [8, '透明な世界', 'Haruka', 'Daydream', art(192, 191), '#8a9391'],
  [10, '深海の城', 'Sora', 'Moonlit', art(272, 191), '#466a75'],
  [11, '花の余韻', '花咲キョウ', 'Flowers', art(352, 191), '#9d8e91'],
  [14, '月の向こう', 'Sora', 'Moonlit', art(432, 191), '#7f98a8'],
  [16, 'また、あした', 'Haruka', 'Daydream', art(29, 279, 69, 73), '#7a8398'],
  [12, '窓辺', 'よるのうた', 'Daydream', art(110, 279, 69, 73), '#839294'],
  [
    13,
    'Lumen',
    'Silent Universe',
    'Fragments',
    art(192, 279, 69, 73),
    '#b0aca0',
  ],
  [17, '白夜', '藍月なくる', 'Petals', art(272, 279, 69, 73), '#a7b1ad'],
  [2, '彼岸花', '花咲キョウ', 'Flowers', art(352, 279, 69, 73), '#9b7d7b'],
  [15, 'Still Here', 'よるのうた', 'Flowers', art(432, 279, 69, 73), '#999e99'],
]
export const demoTracks: Track[] = items.map(
  ([id, title, artist, album, artwork, color]) => ({
    id: 'demo-' + id,
    title,
    artist,
    album,
    artwork,
    color,
    demo: true,
    localPath: '',
    durationMs: 0,
    coverRef: null,
    lyricRef: null,
    favorite: false,
    lastPlayed: null,
  })
)
export const demoScene: ArtworkCrop = art(519, 43, 504, 322)
