import type { ArtworkCrop, Track } from '../../types/music'

function art(x: number, y: number, width = 172, height = 172): ArtworkCrop {
  return {
    source: '/art/music-space.png',
    x,
    y,
    width,
    height,
    sourceWidth: 1536,
    sourceHeight: 1024,
  }
}
const items: [string, string, string, ArtworkCrop, string][] = [
  ['月の向こう', 'Sora', 'Moonlit', art(114, 136), '#476177'],
  ['白い記憶', '藍月なくる', 'Petals', art(390, 136), '#8d9292'],
  ['彼岸花', '花咲キョウ', 'Flowers', art(684, 136), '#794242'],
  ['光を待つ', 'Haruka', 'Daydream', art(974, 136), '#b7a488'],
  ['APOGEE', 'Silent Universe', 'Moonlit', art(1252, 136), '#50566b'],
  ['木漏れ日', 'Sora', 'Daydream', art(114, 359), '#767d55'],
  ['漂う', 'Silent Universe', 'Moonlit', art(390, 359), '#4d586f'],
  ['Purity', '藍月なくる', 'Petals', art(625, 317, 286, 212), '#7cacc8'],
  ['透明な世界', 'Haruka', 'Daydream', art(974, 359), '#648396'],
  ['Midnight', 'よるのうた', 'Moonlit', art(1252, 359), '#747575'],
  ['帰り道', 'Sora', 'Daydream', art(114, 575), '#926c72'],
  ['FRAGMENTS', 'Silent Universe', 'Fragments', art(390, 575), '#737d8b'],
  ['Lumen', 'よるのうた', 'Flowers', art(974, 575), '#a37f79'],
  ['Still Here', '花咲キョウ', 'Flowers', art(1252, 575), '#7b4a5a'],
  ['月影', 'よるのうた', 'Moonlit', art(114, 788), '#456777'],
  ['深海の夢', 'Sora', 'Moonlit', art(390, 788), '#367393'],
  ['また、あした', 'Haruka', 'Daydream', art(684, 788), '#767e98'],
  ['白夜', '藍月なくる', 'Petals', art(974, 788), '#888e96'],
  [
    'ALWAYS SOMEWHERE',
    'Silent Universe',
    'Daydream',
    art(1252, 788),
    '#798760',
  ],
]
export const demoTracks: Track[] = items.map(
  ([title, artist, album, artwork, color], index) => ({
    id: `demo-${index}`,
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
export const demoScene: ArtworkCrop = {
  source: '/art/scenes.png',
  x: 516,
  y: 0,
  width: 508,
  height: 367,
  sourceWidth: 1024,
  sourceHeight: 1024,
}
