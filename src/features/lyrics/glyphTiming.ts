import type { LyricLine } from '../../types/music'

export interface GlyphTiming {
  startMs: number
  endMs: number
}

interface WordSpan extends GlyphTiming {
  from: number
  to: number
}

const segmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null
const isDecoration = (text: string) => /^[\s\p{P}]*$/u.test(text)

function mergeTiming(current: GlyphTiming | undefined, next: GlyphTiming) {
  return current
    ? {
        startMs: Math.min(current.startMs, next.startMs),
        endMs: Math.max(current.endMs, next.endMs),
      }
    : next
}

/** 将真实词时间映射到显示字素；没有可靠对齐信息时保留普通歌词。 */
export function buildGlyphTimings(
  line: LyricLine,
  lineEndMs: number,
  glyphs: readonly string[]
): GlyphTiming[] | undefined {
  if (
    !line.text ||
    !glyphs.length ||
    glyphs.some(glyph => !glyph) ||
    glyphs.join('') !== line.text ||
    !Number.isFinite(line.startMs) ||
    line.startMs < 0 ||
    !Number.isFinite(lineEndMs) ||
    lineEndMs < line.startMs
  )
    return

  const words = line.words?.filter(word => word.text.length)
  if (!words?.length) return
  const spans: WordSpan[] = []
  let textCursor = 0
  let previousStart = line.startMs
  for (let index = 0; index < words.length; index++) {
    const word = words[index]!
    const from = line.text.indexOf(word.text, textCursor)
    const endMs = word.endMs ?? words[index + 1]?.startMs ?? lineEndMs
    if (
      from < 0 ||
      !isDecoration(line.text.slice(textCursor, from)) ||
      !Number.isFinite(word.startMs) ||
      word.startMs < previousStart ||
      !Number.isFinite(endMs) ||
      endMs < word.startMs
    )
      return
    textCursor = from + word.text.length
    previousStart = word.startMs
    spans.push({ from, to: textCursor, startMs: word.startMs, endMs })
  }
  if (!isDecoration(line.text.slice(textCursor))) return

  // 长句按整行显示时只合并真实区间，不再创建逐字中间数据。
  if (glyphs.length === 1)
    return [
      spans.reduce<GlyphTiming>((timing, span) => mergeTiming(timing, span), {
        startMs: spans[0]!.startMs,
        endMs: spans[0]!.endMs,
      }),
    ]

  let offset = 0
  const fallback = () =>
    glyphs.map(segment => {
      const index = offset
      offset += segment.length
      return { segment, index }
    })
  const segments = segmenter
    ? Array.from(segmenter.segment(line.text))
    : fallback()
  let owner = 0
  let boundary = glyphs[0]!.length
  const units: {
    from: number
    to: number
    owner: number
    decoration: boolean
  }[] = []
  for (const { segment, index } of segments) {
    while (index >= boundary) boundary += glyphs[++owner]!.length
    const to = index + segment.length
    // 显示端也必须保持完整字素，不能把组合音标或 ZWJ emoji 拆开。
    if (to > boundary) return
    units.push({ from: index, to, owner, decoration: isDecoration(segment) })
  }

  const timings: (GlyphTiming | undefined)[] = []
  let unitCursor = 0
  for (const span of spans) {
    while (units[unitCursor]!.to <= span.from) unitCursor++
    let last = unitCursor
    let voiced = 0
    while (last < units.length && units[last]!.from < span.to) {
      if (!units[last]!.decoration) voiced++
      last++
    }
    const count = voiced || last - unitCursor
    let position = 0
    let endMs = span.startMs
    for (let index = unitCursor; index < last; index++) {
      const startMs = endMs
      if (!voiced || !units[index]!.decoration) {
        position++
        endMs =
          position === count
            ? span.endMs
            : span.startMs + ((span.endMs - span.startMs) * position) / count
      }
      timings[index] = mergeTiming(timings[index], { startMs, endMs })
    }
    // 标签可能落在同一字素内部，下一词仍需合并这个字素的区间。
    unitCursor = last - 1
  }

  const result: GlyphTiming[] = []
  let previousEnd = spans[0]!.startMs
  units.forEach((unit, index) => {
    const timing = timings[index] ?? {
      startMs: previousEnd,
      endMs: previousEnd,
    }
    previousEnd = timing.endMs
    result[unit.owner] = mergeTiming(result[unit.owner], timing)
  })
  return result
}
