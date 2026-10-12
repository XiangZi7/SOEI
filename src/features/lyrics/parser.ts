import type { LyricDocument, LyricFormat } from '../../types/music'
import { parseLrc } from './lrc'
import { fromFoliaDocument, annotateLine } from './adapter'
import { parseLyricsByFormat } from './folia/parserCore'
import { normalizeTtml } from './ttml'

// Public parser: every nested timestamp is in milliseconds.
export const LYRIC_EXTENSIONS = ['lrc', 'vtt', 'ttml', 'yrc', 'qrc', 'krc', 'awlrc'] as const
export const LYRIC_FILE_ACCEPT = LYRIC_EXTENSIONS.map(extension => `.${extension}`).join(',')

export interface ParseLyricOptions {
  filename?: string
  format?: LyricFormat
  durationMs?: number
  translation?: string
  romanization?: string
  includeInterludes?: boolean
}

export function isLyricFilename(name: string): boolean {
  const extension = name.toLowerCase().match(/\.([^.]+)$/)?.[1]
  return LYRIC_EXTENSIONS.some(candidate => candidate === extension)
}

export function detectLyricFormat(text: string, filename?: string): LyricFormat {
  const extension = filename?.toLowerCase().match(/\.([^.]+)$/)?.[1]
  if (extension && extension !== 'lrc' && isLyricFilename(filename!))
    return extension as LyricFormat
  const content = text.replace(/^\uFEFF/, '').trim()
  if (/<(?:\w+:)?tt(?:\s|>)/i.test(content)) return 'ttml'
  if (/^WEBVTT\b|\d{2}:\d{2}\.\d{3}\s*-->/m.test(content)) return 'vtt'
  if (/<LyricInfo\b|<Lyric_\d+\b|\[\d+,\d+\].*\(\d+,\d+\)/m.test(content)) return 'qrc'
  if (/\[\d+,\d+\].*<\d+,\d+,\d+>/m.test(content)) return 'krc'
  if (/\[\d+,\d+\].*\(\d+,\d+,\d+\)/m.test(content)) return 'yrc'
  if (/\[[\d:.]+\].*<\d+,\d+(?:,\d+)?>/m.test(content)) return 'awlrc'
  if (/<\d+:\d{1,2}(?:[.:]\d{1,3})?>/.test(content) ||
      /\[[\d:.]+\][^[\]\n]+\[[\d:.]+\]/.test(content)) return 'enhanced-lrc'
  return 'lrc'
}

function unwrapQrc(content: string): string {
  const embedded = content.match(/LyricContent\s*=\s*(["'])([\s\S]*?)\1/i)
  if (!embedded) return content
  return embedded[2]!.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) =>
    String.fromCodePoint(hex ? parseInt(hex, 16) : Number(decimal)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

/** Retains SOEI's validated LRC timestamps/offsets; rich formats use the ported engine. */
export function parseLyrics(text: string, options: ParseLyricOptions = {}): LyricDocument {
  const content = text.replace(/\r\n?/g, '\n')
  const format = options.format ?? detectLyricFormat(content, options.filename)
  const hasBracketWords = /\[[\d:.]+\][^[\]\n]+\[[\d:.]+\]/.test(content)
  if (format === 'lrc' || (format === 'enhanced-lrc' && !hasBracketWords)) {
    const parsed = parseLrc(content)
    const lines = parsed.map((line, index) => {
      const endMs = line.words?.[line.words.length - 1]?.endMs ?? parsed[index + 1]?.startMs ??
        (options.durationMs && options.durationMs > line.startMs ? options.durationMs : line.startMs + 5000)
      return annotateLine(line, Math.max(line.startMs + 1, endMs))
    })
    // Supplemental tracks share the same robust millisecond parser.
    const translations = parseLrc(options.translation ?? '')
    const romanizations = parseLrc(options.romanization ?? '')
    const pairTrack = (track: typeof translations, field: 'translation' | 'romanization') => {
      const used = new Set<number>()
      const candidates = lines.flatMap((line, lineIndex) => track.flatMap((entry, entryIndex) => {
        const diff = Math.abs(line.startMs - entry.startMs)
        return diff < 1000 ? [{ lineIndex, entryIndex, diff }] : []
      })).sort((a, b) => a.diff - b.diff || a.lineIndex - b.lineIndex || a.entryIndex - b.entryIndex)
      const assigned = new Set<number>()
      for (const candidate of candidates) {
        if (used.has(candidate.entryIndex) || assigned.has(candidate.lineIndex)) continue
        lines[candidate.lineIndex]![field] = track[candidate.entryIndex]!.text
        used.add(candidate.entryIndex)
        assigned.add(candidate.lineIndex)
      }
    }
    pairTrack(translations, 'translation')
    pairTrack(romanizations, 'romanization')
    return {
      lines, format, isWordByWord: lines.some(line => !!line.words?.length),
      title: content.match(/\[ti:([^\]]*)\]/i)?.[1]?.trim(),
      artist: content.match(/\[ar:([^\]]*)\]/i)?.[1]?.trim(),
    }
  }
  return fromFoliaDocument(parseLyricsByFormat(
    format,
    format === 'qrc' ? unwrapQrc(content) : format === 'ttml' ? normalizeTtml(content) : content,
    options.translation,
    { includeInterludes: options.includeInterludes ?? false },
    options.romanization,
  ), format)
}
