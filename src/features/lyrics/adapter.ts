import type {
  LyricAlternateText,
  LyricBackgroundVocal,
  LyricDocument,
  LyricFormat,
  LyricLine,
  LyricRuby,
  LyricSyllable,
  LyricWord,
} from '../../types/music'
import type {
  Line,
  LyricAlternateText as FoliaAlternateText,
  LyricBackgroundVocal as FoliaBackgroundVocal,
  LyricData,
  LyricRuby as FoliaRuby,
  LyricSyllable as FoliaSyllable,
  Word,
} from './folia/model'
import { buildLineRenderHints } from './folia/renderHints'

// Only this boundary converts Folia seconds to SOEI milliseconds.
const milliseconds = (seconds: number) => Math.round(seconds * 1000)
const seconds = (ms: number) => ms / 1000

function fromRuby(value: FoliaRuby): LyricRuby {
  const { startTime, endTime, ...rest } = value
  return {
    ...rest,
    startMs: milliseconds(startTime),
    endMs: milliseconds(endTime),
  }
}
function toRuby(value: LyricRuby): FoliaRuby {
  const { startMs, endMs, ...rest } = value
  return { ...rest, startTime: seconds(startMs), endTime: seconds(endMs) }
}
function fromSyllable(value: FoliaSyllable): LyricSyllable {
  const { ruby, ...rest } = value
  return { ...fromRuby(rest), ...(ruby ? { ruby: ruby.map(fromRuby) } : {}) }
}
function toSyllable(value: LyricSyllable): FoliaSyllable {
  const { ruby, ...rest } = value
  return { ...toRuby(rest), ...(ruby ? { ruby: ruby.map(toRuby) } : {}) }
}
function fromWord(value: Word): LyricWord {
  const { syllables, estimated: _estimated, ...rest } = value
  return {
    ...fromRuby(rest),
    ...(syllables ? { syllables: syllables.map(fromSyllable) } : {}),
  }
}
function toWord(value: LyricWord, fallbackEndMs: number): Word {
  const { syllables, ...rest } = value
  return {
    ...toRuby({ ...rest, endMs: value.endMs ?? fallbackEndMs }),
    ...(syllables ? { syllables: syllables.map(toSyllable) } : {}),
  }
}
function fromAlternate(value: FoliaAlternateText): LyricAlternateText {
  const { syllables, ...rest } = value
  return {
    ...rest,
    ...(syllables ? { syllables: syllables.map(fromSyllable) } : {}),
  }
}
function toAlternate(value: LyricAlternateText): FoliaAlternateText {
  const { syllables, ...rest } = value
  return {
    ...rest,
    ...(syllables ? { syllables: syllables.map(toSyllable) } : {}),
  }
}
function fromVocal(value: FoliaBackgroundVocal): LyricBackgroundVocal {
  const { words, alternateTexts, ...rest } = value
  return {
    ...fromRuby(rest),
    words: words.some(word => !word.estimated) ? words.map(fromWord) : [],
    ...(alternateTexts
      ? { alternateTexts: alternateTexts.map(fromAlternate) }
      : {}),
  }
}
function toVocal(value: LyricBackgroundVocal): FoliaBackgroundVocal {
  const { words, alternateTexts, ...rest } = value
  return {
    ...toRuby(rest),
    words: words.map(word => toWord(word, value.endMs)),
    ...(alternateTexts
      ? { alternateTexts: alternateTexts.map(toAlternate) }
      : {}),
  }
}

export function fromFoliaDocument(
  data: LyricData,
  format: LyricFormat
): LyricDocument {
  const isWordByWord = Boolean(data.isWordByWord)
  return {
    ...data,
    format,
    isWordByWord,
    lines: data.lines.map((line, index) => {
      const {
        startTime,
        endTime,
        fullText,
        words,
        alternateTexts,
        backgroundVocal,
        backgroundVocals,
        renderHints,
        ...rest
      } = line
      const vocals =
        backgroundVocals ?? (backgroundVocal ? [backgroundVocal] : [])
      const timed =
        isWordByWord &&
        fullText !== '......' &&
        words.some(word => !word.estimated)
      return {
        ...rest,
        id: `${index}:${line.id ?? startTime}`,
        startMs: milliseconds(startTime),
        endMs: milliseconds(endTime),
        text: fullText,
        timing: timed ? 'word' : 'line',
        // Plain line timing must never be presented as measured singing timing.
        ...(timed ? { words: words.map(fromWord) } : {}),
        ...(alternateTexts
          ? { alternateTexts: alternateTexts.map(fromAlternate) }
          : {}),
        ...(vocals.length ? { backgroundVocals: vocals.map(fromVocal) } : {}),
        ...(renderHints
          ? {
              renderHints: {
                rawDurationMs: milliseconds(renderHints.rawDuration),
                renderEndMs: milliseconds(renderHints.renderEndTime),
                timingClass: renderHints.timingClass,
                lineTransitionMode: renderHints.lineTransitionMode,
                wordRevealMode: renderHints.wordRevealMode,
              },
            }
          : {}),
      }
    }),
  }
}

/** Compile once per line/end boundary, outside the frame loop. */
export function toFoliaLine(
  line: LyricLine,
  fallbackEndMs = line.startMs + 5000
): Line {
  const {
    id,
    startMs,
    endMs,
    text,
    words,
    alternateTexts,
    backgroundVocals,
    renderHints,
    timing: _timing,
    ...rest
  } = line
  const resolvedEnd = endMs ?? fallbackEndMs
  return {
    ...rest,
    id,
    startTime: seconds(startMs),
    endTime: seconds(resolvedEnd),
    fullText: text,
    words: (words ?? []).map((word, index) =>
      toWord(word, words?.[index + 1]?.startMs ?? resolvedEnd)
    ),
    ...(alternateTexts
      ? { alternateTexts: alternateTexts.map(toAlternate) }
      : {}),
    ...(backgroundVocals
      ? { backgroundVocals: backgroundVocals.map(toVocal) }
      : {}),
    ...(renderHints
      ? {
          renderHints: {
            rawDuration: seconds(renderHints.rawDurationMs),
            renderEndTime: seconds(renderHints.renderEndMs),
            timingClass: renderHints.timingClass,
            lineTransitionMode: renderHints.lineTransitionMode,
            wordRevealMode: renderHints.wordRevealMode,
          },
        }
      : {}),
  }
}

export function annotateLine(line: LyricLine, endMs: number): LyricLine {
  const hints = buildLineRenderHints(toFoliaLine(line, endMs))
  return {
    ...line,
    endMs,
    timing: line.words?.length ? 'word' : 'line',
    renderHints: {
      rawDurationMs: milliseconds(hints.rawDuration),
      renderEndMs: milliseconds(hints.renderEndTime),
      timingClass: hints.timingClass,
      lineTransitionMode: hints.lineTransitionMode,
      wordRevealMode: hints.wordRevealMode,
    },
  }
}
