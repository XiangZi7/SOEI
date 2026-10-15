// Adapted from Folia tilt/VisualizerTilt.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext'
import type { Line, Word } from '../../lyrics/folia/model'
import { SentenceLayout } from '../../lyrics/folia/sentenceLayout'
import { buildWordGraphemeTimings } from '../../lyrics/folia/graphemeTiming'
import { getLineRenderEndTime } from '../../lyrics/folia/renderHints'
import type { Theme } from '../../theme/model'
import {
  resolveThemeFontStack,
  resolveThemeFontWeight,
} from '../../theme/fontStacks'

// Tilt：把一句歌词按概率切成 1-4 行，两种排版交替
// （正常横排 vs 大号斜体错落），行按时间顺序依次显现；
// 斜体行的字符带上下交替偏移。

export type TiltColorScheme = 'default' | 'swap' | 'accentAll' | 'primaryAll'

export interface TiltTuning {
  splitProbability: number
  tiltStyleProbability: number
  colorScheme: TiltColorScheme
}

export const DEFAULT_TILT_TUNING: TiltTuning = {
  splitProbability: 0.75,
  tiltStyleProbability: 0.35,
  colorScheme: 'default',
}

const COLOR_SCHEMES: readonly TiltColorScheme[] = [
  'default',
  'swap',
  'accentAll',
  'primaryAll',
]
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function resolveTiltTuning(tuning?: unknown): TiltTuning {
  const source = (tuning ?? {}) as Partial<TiltTuning>
  const scheme = source.colorScheme
  return {
    splitProbability: Number.isFinite(source.splitProbability)
      ? clamp01(source.splitProbability as number)
      : DEFAULT_TILT_TUNING.splitProbability,
    tiltStyleProbability: Number.isFinite(source.tiltStyleProbability)
      ? clamp01(source.tiltStyleProbability as number)
      : DEFAULT_TILT_TUNING.tiltStyleProbability,
    colorScheme:
      scheme && COLOR_SCHEMES.includes(scheme)
        ? scheme
        : DEFAULT_TILT_TUNING.colorScheme,
  }
}

const CHAR_REF_LENGTH = 20
const LOG_OFFSET = 4
const LINE_THRESHOLDS = [0.45, 1.05, 1.7] as const
const REM_PX = 16
const RESPLIT_THRESHOLD = 1.6
const SCALE_FLOOR_NORMAL = 0.55
const SCALE_FLOOR_TILT = 0.5

export const seededRandom = (seed: number, offset: number): number => {
  const value = Math.sin(seed * 1000 + offset) * 10000
  return value - Math.floor(value)
}

/** 字数越多越可能切得多；jitter 让同样长度的句子也有变化。 */
export function determineLineCount(
  charCount: number,
  seed: number,
  splitProbability: number
): number {
  const normalized =
    Math.log(charCount + LOG_OFFSET) / Math.log(CHAR_REF_LENGTH + LOG_OFFSET)
  const jitter = seededRandom(seed, 1) * 0.6 + 0.7
  const score = normalized * jitter * splitProbability
  if (score < LINE_THRESHOLDS[0]) return 1
  if (score < LINE_THRESHOLDS[1]) return 2
  if (score < LINE_THRESHOLDS[2]) return 3
  return 4
}

export interface TiltSegment {
  text: string
  isTilt: boolean
  /** 末行只剩一两个字时放大一点，避免看着像掉了字。 */
  isShortLastLine: boolean
  /** 该段在整句 fullText 中的起始字符位置，用于回溯词时间。 */
  charOffset: number
}

export interface TiltLayout {
  segments: TiltSegment[]
  scaleMultiplier: number
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})
const isSpace = (text: string) => /^\s+$/.test(text)

export const tiltGraphemes = (text: string): string[] =>
  [...GRAPHEME_SEGMENTER.segment(text)].map(entry => entry.segment)

/** 可用宽度：视口的 85%，窄屏下不低于 320。 */
export const tiltAvailableWidth = (viewportWidth: number): number =>
  Math.max(320, viewportWidth) * 0.85

/** 测量基准字号，normal 与 tilt 两种排版共用。 */
export const tiltMeasureFontPx = (
  viewportWidth: number,
  fontScale: number
): number => Math.max(viewportWidth * 0.06875, 5.625 * REM_PX * fontScale)

function measureAtSize(text: string, pxSize: number, fontSpec: string): number {
  try {
    const prepared = prepareWithSegments(text, fontSpec)
    const layout = layoutWithLines(prepared, 99999, pxSize * 1.4)
    return layout.lines[0]?.width ?? text.length * pxSize * 0.6
  } catch {
    // 字体尚未就绪或环境没有测量能力时按字数估算，不要让排版整体失败。
    return text.length * pxSize * 0.6
  }
}

/** 末行过短（<=2 字且不到上一行一半）时标记放大。 */
function markShortLastLine(segments: TiltSegment[]): TiltSegment[] {
  if (segments.length < 2) return segments
  const last = segments[segments.length - 1]!
  if (last.isTilt || last.text.trim().length > 2) return segments
  const previous = segments[segments.length - 2]!
  if (last.text.trim().length * 2 <= previous.text.length)
    segments[segments.length - 1] = { ...last, isShortLastLine: true }
  return segments
}

function toSegments(
  texts: string[],
  tiltIndex: number
): { segments: TiltSegment[]; consumed: number } {
  let offset = 0
  const segments = texts.map((text, index) => {
    const leading = text.length - text.trimStart().length
    const segment: TiltSegment = {
      text: text.trim(),
      isTilt: index === tiltIndex,
      isShortLastLine: false,
      charOffset: offset + leading,
    }
    offset += text.length
    return segment
  })
  return { segments, consumed: offset }
}

export interface TiltLayoutInput {
  fullText: string
  /** 行开始时间作种子，所以同一句不会每次重渲染都重新洗牌。 */
  lineSeed: number
  tuning: TiltTuning
  theme: Theme
  fontScale: number
  viewportWidth: number
}

export function buildTiltLayout({
  fullText,
  lineSeed,
  tuning,
  theme,
  fontScale,
  viewportWidth,
}: TiltLayoutInput): TiltLayout {
  const fontStack = resolveThemeFontStack(theme)
  const basePx = tiltMeasureFontPx(viewportWidth, fontScale)
  const normalFontSpec = `${resolveThemeFontWeight(theme, 400)} ${basePx}px ${fontStack}`
  const tiltFontSpec = `${resolveThemeFontWeight(theme, 300)} ${basePx}px ${fontStack} italic`
  const availableWidth = tiltAvailableWidth(viewportWidth)

  const trimmed = fullText.trim()
  // 纯省略号/间奏行不切分。
  const ellipsisOnly = /^[\s.…·。]+$/.test(trimmed)
  const texts = ellipsisOnly
    ? [fullText]
    : SentenceLayout.splitIntoSentences(
        fullText,
        determineLineCount(trimmed.length, lineSeed, tuning.splitProbability),
        lineSeed
      ).map(unit => unit.text)

  // 先掷出哪些行有资格走斜体，再从候选里选一行 —— 整句最多一行斜体。
  const candidates: number[] = []
  texts.forEach((_, index) => {
    if (seededRandom(lineSeed, 100 + index) < tuning.tiltStyleProbability)
      candidates.push(index)
  })
  const tiltIndex = candidates.length
    ? candidates[Math.floor(seededRandom(lineSeed, 200) * candidates.length)]!
    : -1

  const { segments } = toSegments(texts, tiltIndex)

  const widest = (list: TiltSegment[], spec: string) =>
    list
      .map(segment => ({
        segment,
        width: measureAtSize(segment.text, basePx, spec),
      }))
      .sort((a, b) => b.width - a.width)[0]
  const widestTilt = widest(
    segments.filter(segment => segment.isTilt),
    tiltFontSpec
  )
  const widestNormal = widest(
    segments.filter(segment => !segment.isTilt),
    normalFontSpec
  )
  const tiltOverflow = widestTilt ? widestTilt.width / availableWidth : 0
  const normalOverflow = widestNormal ? widestNormal.width / availableWidth : 0
  const maxOverflow = Math.max(tiltOverflow, normalOverflow)

  if (maxOverflow <= 1)
    return { segments: markShortLastLine(segments), scaleMultiplier: 1 }

  // 溢出太多时宁可多切一行，也不要把字缩到看不清。
  if (maxOverflow >= RESPLIT_THRESHOLD) {
    const targetWidth = availableWidth * (RESPLIT_THRESHOLD - 0.15)
    const totalWidth = measureAtSize(fullText, basePx, normalFontSpec)
    const needed = Math.min(
      4,
      Math.max(segments.length + 1, Math.ceil(totalWidth / targetWidth))
    )
    if (needed > segments.length) {
      const reSplit = SentenceLayout.splitIntoSentences(
        fullText,
        needed,
        lineSeed
      ).map(unit => unit.text)
      const { segments: next } = toSegments(reSplit, -1)
      if (
        next.length &&
        seededRandom(lineSeed, 300) < tuning.tiltStyleProbability
      ) {
        const picked = Math.floor(seededRandom(lineSeed, 301) * next.length)
        next[picked]!.isTilt = true
      }
      const nextTilt = next.find(segment => segment.isTilt)
      const nextNormal = widest(
        next.filter(segment => !segment.isTilt),
        normalFontSpec
      )
      let scale = 1
      if (nextTilt) {
        const width = measureAtSize(nextTilt.text, basePx, tiltFontSpec)
        if (width > availableWidth)
          scale = Math.max(SCALE_FLOOR_TILT, availableWidth / width)
      } else if (nextNormal && nextNormal.width > availableWidth)
        scale = Math.max(SCALE_FLOOR_NORMAL, availableWidth / nextNormal.width)
      return { segments: markShortLastLine(next), scaleMultiplier: scale }
    }
  }

  const scaleMultiplier =
    tiltOverflow >= normalOverflow && widestTilt
      ? Math.max(SCALE_FLOOR_TILT, availableWidth / widestTilt.width)
      : widestNormal
        ? Math.max(SCALE_FLOOR_NORMAL, availableWidth / widestNormal.width)
        : 1
  return { segments: markShortLastLine(segments), scaleMultiplier }
}

/** 某段文本覆盖的词下标区间，用于把段落对回真实词时间。 */
export function findSegmentWordRange(
  charOffset: number,
  segmentText: string,
  fullText: string,
  words: Word[]
): { startWordIndex: number; endWordIndex: number } {
  if (charOffset < 0 || charOffset >= fullText.length)
    return { startWordIndex: 0, endWordIndex: words.length }
  const segmentEnd = charOffset + segmentText.length
  let cursor = 0
  let startWordIndex = 0
  let endWordIndex = words.length
  for (let index = 0; index < words.length; index += 1) {
    const text = words[index]!.text
    const start = fullText.indexOf(text, cursor)
    if (start === -1) {
      cursor += text.length
      continue
    }
    const end = start + text.length
    if (start <= charOffset && end > charOffset) startWordIndex = index
    if (start < segmentEnd && end >= segmentEnd) {
      endWordIndex = index + 1
      break
    }
    cursor = end
  }
  return { startWordIndex, endWordIndex }
}

export interface TiltCharTiming {
  charIndex: number
  startTime: number
  endTime: number
}

/**
 * 段内每个非空白字素的时间。优先用音节/词的真实时间；
 * 对不齐时整段按字数均分 —— 宁可均分，也不要让部分字素拿到错位的时间。
 */
export function buildTiltCharTimings(
  charOffset: number,
  segmentText: string,
  segmentStartTime: number,
  segmentEndTime: number,
  line: Line | null
): TiltCharTiming[] {
  const graphemes = tiltGraphemes(segmentText)
  if (!line || !graphemes.length) return []
  const nonSpaceCount = graphemes.filter(text => !isSpace(text)).length
  if (!nonSpaceCount) return []

  const { startWordIndex, endWordIndex } = findSegmentWordRange(
    charOffset,
    segmentText,
    line.fullText,
    line.words
  )
  const segmentWords = line.words.slice(startWordIndex, endWordIndex)
  const timings: TiltCharTiming[] = []
  let charIndex = 0

  for (const word of segmentWords) {
    if (word.syllables?.length) {
      for (const timing of buildWordGraphemeTimings(word)) {
        if (isSpace(timing.char)) continue
        if (charIndex >= nonSpaceCount) break
        timings.push({
          charIndex,
          startTime: timing.startTime,
          endTime: timing.endTime,
        })
        charIndex += 1
      }
      continue
    }
    const wordGraphemes = tiltGraphemes(word.text)
    const wordNonSpace = wordGraphemes.filter(text => !isSpace(text)).length
    if (!wordNonSpace) continue
    const charDuration =
      Math.max(word.endTime - word.startTime, 0.05) / wordNonSpace
    let withinWord = 0
    for (const grapheme of wordGraphemes) {
      if (charIndex >= nonSpaceCount) break
      if (isSpace(grapheme)) continue
      timings.push({
        charIndex,
        startTime: word.startTime + withinWord * charDuration,
        endTime: word.startTime + (withinWord + 1) * charDuration,
      })
      charIndex += 1
      withinWord += 1
    }
  }

  if (timings.length === nonSpaceCount) return timings

  // 对不齐：整段均分。
  const totalDuration = Math.max(segmentEndTime - segmentStartTime, 0.3)
  const average = totalDuration / nonSpaceCount
  return Array.from({ length: nonSpaceCount }, (_, index) => ({
    charIndex: index,
    startTime: segmentStartTime + index * average,
    endTime: segmentStartTime + (index + 1) * average,
  }))
}

/** 每段的时间区间，取该段覆盖的词；没有词时回落到整行。 */
export function buildTiltSegmentTimings(
  layout: TiltLayout,
  line: Line
): { start: number; end: number }[] {
  return layout.segments.map(segment => {
    const { startWordIndex, endWordIndex } = findSegmentWordRange(
      segment.charOffset,
      segment.text,
      line.fullText,
      line.words
    )
    const words = line.words.slice(startWordIndex, endWordIndex)
    if (!words.length)
      return { start: line.startTime, end: getLineRenderEndTime(line) }
    return {
      start: words[0]!.startTime,
      end: words[words.length - 1]!.endTime,
    }
  })
}

/** 颜色方案：normal 行与 tilt 行各取一色。 */
export function tiltColors(
  theme: Theme,
  scheme: TiltColorScheme
): { normal: string; tilt: string } {
  const accent = theme.accentColor || theme.primaryColor
  switch (scheme) {
    case 'swap':
      return { normal: accent, tilt: theme.primaryColor }
    case 'accentAll':
      return { normal: accent, tilt: accent }
    case 'primaryAll':
      return { normal: theme.primaryColor, tilt: theme.primaryColor }
    default:
      return { normal: theme.primaryColor, tilt: accent }
  }
}
