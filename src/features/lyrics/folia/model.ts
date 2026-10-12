import type { LineRenderHints } from './renderHints'
// Internal Folia model: seconds. Public SOEI data crosses adapter.ts in milliseconds.
export interface LyricRuby {
  text: string
  startTime: number // Seconds
  endTime: number // Seconds
}

export interface LyricSyllable {
  text: string
  startTime: number // Seconds
  endTime: number // Seconds
  endsWithSpace?: boolean
  ruby?: LyricRuby[]
  obscene?: boolean
  emptyBeat?: number
}

export interface LyricAlternateText {
  role: 'translation' | 'romanization' | string
  language?: string
  text: string
  syllables?: LyricSyllable[]
}

export interface Word {
  text: string
  startTime: number // Seconds
  endTime: number // Seconds
  syllables?: LyricSyllable[]
  estimated?: boolean
}

export interface LyricBackgroundVocal {
  text: string
  startTime: number // Seconds
  endTime: number // Seconds
  words: Word[]
  agentId?: string
  translation?: string
  romanization?: string
  alternateTexts?: LyricAlternateText[]
}

// 'both' stacks romanization above translation; only the shared bottom subtitle overlay renders both rows.
// Modes that lay translation out inside their own lyric layout (Monet, Pendolo, Lattice, Still) fall back to translation only.
export type SubtitleContentMode =
  'translation' | 'romanization' | 'both' | 'none'

export interface LyricAgent {
  id: string
  name?: string
  type?: string
}

export interface Line {
  words: Word[]
  startTime: number
  endTime: number
  fullText: string
  translation?: string
  id?: string
  agentId?: string
  songPart?: string
  blockIndex?: number
  romanization?: string
  alternateTexts?: LyricAlternateText[]
  backgroundVocal?: LyricBackgroundVocal
  backgroundVocals?: LyricBackgroundVocal[]
  renderHints?: LineRenderHints
  isChorus?: boolean
  chorusEffect?: 'bars' | 'circles' | 'beams'
  // User-saved fine word boundaries for fullText, baked in upstream by the lyric setter.
  // join('') must equal fullText. When present it wins over Intl.Segmenter word segmentation.
  wordSegments?: string[]
}

export interface LyricData {
  lines: Line[]
  title?: string
  artist?: string
  isWordByWord?: boolean
  ttml?: {
    timingMode?: 'Word' | 'Line'
    agents?: Record<string, LyricAgent>
  }
}

export interface LyricProcessingOptions {
  includeInterludes?: boolean
}
export interface Theme {
  wordColors?: { word: string; color: string }[]
}
