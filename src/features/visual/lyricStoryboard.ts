import type { SceneLayout } from '../../types/music'
import { lyricFragments } from './sceneModes'
import { lyricGlyphs } from './lyricText'

export type KineticLayout = Exclude<SceneLayout, 'readable' | 'title'>

export function isKineticLayout(layout: SceneLayout): layout is KineticLayout {
  return layout !== 'readable' && layout !== 'title'
}

function trackSeed(id: string): number {
  let seed = 0
  for (const character of id) seed = (seed * 31 + character.charCodeAt(0)) >>> 0
  return seed
}

// 每首歌固定起点，相邻行轮换构图；暂停、拖动和重新渲染不会重新随机。
export function shotVariant(trackId: string, index: number, seed = 0): number {
  return (trackSeed(trackId) + Math.max(0, index) + Math.max(0, seed)) % 6
}

const palettes = [
  { accent: '#e8c879', muted: '#aab8ce', glow: '#7cacc8' },
  { accent: '#e6b9bb', muted: '#b4acc9', glow: '#9b7cae' },
  { accent: '#aed5c8', muted: '#a4bac5', glow: '#699caa' },
]
export function shotPalette(layout: SceneLayout, variant: number) {
  return palettes[
    layout === 'montage' || layout === 'collage' ? variant % 3 : 0
  ]!
}

const placements = [
  [
    'self-start -rotate-2',
    'self-end rotate-2',
    'self-center -rotate-1',
    'self-end rotate-1',
  ],
  [
    'self-center rotate-1',
    'self-center -rotate-2',
    'self-center rotate-2',
    'self-center -rotate-1',
  ],
  [
    'self-end rotate-2',
    'self-start -rotate-2',
    'self-end rotate-1',
    'self-start -rotate-1',
  ],
  [
    'self-start -rotate-3',
    'self-center -rotate-1',
    'self-end rotate-2',
    'self-center rotate-1',
  ],
]
const directions = [
  [
    { x: -36, y: 12 },
    { x: 30, y: -15 },
    { x: 0, y: 28 },
    { x: -24, y: 0 },
  ],
  [
    { x: 0, y: 30 },
    { x: 0, y: -24 },
    { x: -28, y: 0 },
    { x: 24, y: 0 },
  ],
  [
    { x: 35, y: 0 },
    { x: -35, y: 0 },
    { x: 0, y: 25 },
    { x: 0, y: -25 },
  ],
  [
    { x: -25, y: 25 },
    { x: 20, y: -20 },
    { x: 30, y: 15 },
    { x: -20, y: -15 },
  ],
]

export function buildLyricShot(
  layout: KineticLayout,
  text: string,
  trackId: string,
  index: number,
  seed = 0
) {
  const variant = shotVariant(trackId, index, seed)
  const placementVariant = variant % 4
  const pieces = lyricFragments(text)
  // 最短的片段作为视觉重心，长句保持完整阅读，最多渲染 160 个独立字素。
  const hero = pieces.reduce(
    (best, piece, position) =>
      lyricGlyphs(piece).length <= lyricGlyphs(pieces[best]!).length
        ? position
        : best,
    0
  )
  const compact = lyricGlyphs(text).length > 36
  const characters = lyricGlyphs(text).length <= 160
  return {
    variant,
    hero,
    compact,
    // 竖向构图只选短 CJK 句，英文和长句保留横向阅读。
    vertical:
      layout === 'montage' &&
      variant === 1 &&
      !compact &&
      !/[a-z]/iu.test(text) &&
      lyricGlyphs(text).length <= 18,
    frame: layout === 'montage' && variant === 4,
    outline:
      (layout === 'montage' && variant === 3) ||
      (layout === 'echo' && variant >= 4),
    fragments: pieces.map((piece, position) => ({
      text: piece,
      glyphs: characters ? lyricGlyphs(piece) : [piece],
      placement: compact
        ? 'self-center'
        : layout === 'echo'
          ? variant % 2
            ? 'self-start'
            : 'self-center'
          : placements[placementVariant]![position]!,
      direction: directions[placementVariant]![position]!,
      emphasis: !compact && position === hero,
      card: layout === 'collage' || (layout === 'montage' && variant === 2),
    })),
  }
}
