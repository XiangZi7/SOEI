const segmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

export function lyricGlyphs(text: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(text), item => item.segment)
    : Array.from(text)
}
