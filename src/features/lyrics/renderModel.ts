import type { LyricLine, SubtitleContentMode } from '../../types/music'
import { toFoliaLine } from './adapter'
import { buildGlyphTimings } from './glyphTiming'
import { splitLyricGraphemes } from './folia/graphemeTiming'
import {
  buildMonetDisplayTokens,
  resolveMonetSubtitleTracks,
  measureMonetGraphemeOffsets,
  resolveMonetSweepEdgeSoftness,
  resolveMonetSweepEnd,
  clearMonetMeasurementCaches,
} from './folia/monetLyricsModel'
import { resolveMonetFillWidth, resolveMonetGlow } from './folia/monetLyricMotion'
import type { GlyphTiming } from './glyphTiming'
import type { GraphemeTiming } from './folia/graphemeTiming'

// Vue-facing rendering model: compile text once, evaluate only numeric state per frame.
export interface LyricDisplayToken {
  key: string
  text: string
  timed: boolean
  startMs: number
  endMs: number
  timings: GlyphTiming[]
  parts: { text: string; ruby?: string }[]
}
const tokenTimings = new WeakMap<LyricDisplayToken, GraphemeTiming[]>()

export function buildLyricDisplayTokens(line: LyricLine, endMs: number): LyricDisplayToken[] {
  const upstream = buildMonetDisplayTokens(toFoliaLine(line, endMs))
  let wordIndex = 0
  return upstream.map(token => {
    const word = token.timed && line.words?.length ? line.words[wordIndex++] : undefined
    const startMs = token.startTime === null ? line.startMs : token.startTime * 1000
    const tokenEndMs = token.endTime === null ? endMs : token.endTime * 1000
    const timings = word && line.timing !== 'line' ? buildGlyphTimings(
      { id: token.key, text: token.text, startMs, words: [word] },
      tokenEndMs,
      splitLyricGraphemes(token.text),
    ) : undefined
    const result: LyricDisplayToken = {
      key: token.key,
      text: token.text,
      timed: !!timings,
      startMs,
      endMs: tokenEndMs,
      timings: timings ?? [],
      parts: word?.syllables?.length && word.syllables.map(syllable => syllable.text).join('') === token.text
        ? word.syllables.map(syllable => ({ text: syllable.text, ruby: syllable.ruby?.map(tag => tag.text).join('') }))
        : [{ text: token.text }],
    }
    tokenTimings.set(result, result.timings.map(timing => ({
      char: '', startTime: timing.startMs / 1000, endTime: timing.endMs / 1000,
    })))
    return result
  })
}

export function resolveSubtitleTracks(line: LyricLine, mode: SubtitleContentMode = 'both') {
  return resolveMonetSubtitleTracks(toFoliaLine(line), mode).map(track => ({
    ...track, language: line.alternateTexts?.find(text => text.role === track.role && text.text === track.text)?.language,
  }))
}

export { clearMonetMeasurementCaches as clearLyricMeasurements }

export function measureTokenOffsets(text: string, fontPx: number, fontSpec: string): number[] {
  return measureMonetGraphemeOffsets(text, fontPx, fontSpec)
}

export function lyricTokenFrame(
  token: LyricDisplayToken,
  positionMs: number,
  offsets: number[],
  fontPx: number,
  lineEndMs: number,
  reducedMotion = false,
) {
  const timings = tokenTimings.get(token) ?? []
  const filled = token.timed ? resolveMonetFillWidth(
    positionMs / 1000, token.startMs / 1000, token.endMs / 1000, offsets, timings,
  ) : 0
  const softness = resolveMonetSweepEdgeSoftness(fontPx)
  return {
    fillPx: resolveMonetSweepEnd(filled, offsets[offsets.length - 1] ?? 0, softness),
    softnessPx: softness,
    glow: reducedMotion || !token.timed ? 0 : resolveMonetGlow(
      positionMs / 1000, token.startMs / 1000, token.endMs / 1000, lineEndMs / 1000),
    status: positionMs < token.startMs ? 'waiting' : positionMs < token.endMs ? 'active' : 'passed',
  }
}
