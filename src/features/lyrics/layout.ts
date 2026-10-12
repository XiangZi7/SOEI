import type { LyricLine } from '../../types/music'
import { toFoliaLine } from './adapter'
import { buildPostLyricLayoutUnits } from './folia/cjkSemanticLayout'
import { SentenceLayout } from './folia/sentenceLayout'
import { splitLyricGraphemes } from './folia/graphemeTiming'

// Parser words stay intact; sentence/semantic units belong only to display planning.
export function buildSemanticFragments(
  line: LyricLine,
  fallback: string[]
): string[] {
  if (line.text.length > 160) return [line.text]
  const source = toFoliaLine(line)
  const units = buildPostLyricLayoutUnits(source, {
    semantic: true,
    sticky: true,
  })
  const targetCount =
    fallback.length > 1
      ? fallback.length
      : splitLyricGraphemes(line.text).length > 24
        ? 2
        : 1
  const candidates = SentenceLayout.splitIntoSentences(
    line.text,
    targetCount,
    line.startMs
  ).map(part => part.text)
  if (candidates.length > 4 || candidates.join('') !== line.text)
    return fallback
  // Reject boundaries inside a parser word/semantic phrase or a Unicode grapheme.
  const allowed = new Set<number>([0, line.text.length])
  let offset = 0
  for (const unit of units) {
    offset += unit.text.length
    allowed.add(offset)
  }
  const graphemeEdges = new Set<number>([0])
  offset = 0
  for (const glyph of splitLyricGraphemes(line.text)) {
    offset += glyph.length
    graphemeEdges.add(offset)
  }
  offset = 0
  for (const part of candidates) {
    offset += part.length
    if (!graphemeEdges.has(offset) || (units.length && !allowed.has(offset)))
      return [line.text]
  }
  return candidates
}

export function lyricRubyByGrapheme(
  line: LyricLine
): Map<number, { text: string; ruby: string }> {
  const result = new Map<number, { text: string; ruby: string }>()
  let cursor = 0
  for (const word of line.words ?? []) {
    const start = line.text.indexOf(word.text, cursor)
    if (start < 0) continue
    let offset = start
    for (const syllable of word.syllables ?? []) {
      const ruby = syllable.ruby?.map(tag => tag.text).join('')
      if (ruby) result.set(offset, { text: syllable.text, ruby })
      offset += syllable.text.length
    }
    cursor = start + word.text.length
  }
  return result
}

export function richLyricGlyphs(
  line: LyricLine,
  text: string,
  startOffset: number
) {
  const ruby = lyricRubyByGrapheme(line)
  const result: { text: string; ruby?: string }[] = []
  let offset = 0
  while (offset < text.length) {
    const annotated = ruby.get(startOffset + offset)
    const glyph =
      annotated && text.slice(offset).startsWith(annotated.text)
        ? annotated
        : { text: splitLyricGraphemes(text.slice(offset))[0]! }
    result.push(glyph)
    offset += glyph.text.length
  }
  return result
}
