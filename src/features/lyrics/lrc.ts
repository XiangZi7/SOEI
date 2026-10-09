import type { LyricLine, LyricWord } from '../../types/music'

function timestampMs(value: string): number | undefined {
  const stamp = value.match(/^(\d+):(\d{1,2})(?:[.:](\d{1,3}))?$/)
  if (!stamp || Number(stamp[2]) >= 60) return
  const time =
    Number(stamp[1]) * 60000 +
    Number(stamp[2]) * 1000 +
    Number((stamp[3] ?? '').padEnd(3, '0'))
  return Number.isSafeInteger(time) ? time : undefined
}

function enhancedLyrics(
  content: string,
  lineStartMs: number
): Pick<LyricLine, 'text' | 'words'> {
  // 只识别时间形状的标签，保留歌词中普通的尖括号文本。
  const inlineTag = /<([+-]?\d+:[^<>]*)>/g
  const tags = [...content.matchAll(inlineTag)]
  if (!tags.length) return { text: content }
  const text = content.replace(inlineTag, '').trim()
  const times: number[] = []
  let previousTime = lineStartMs
  for (const tag of tags) {
    const time = timestampMs(tag[1]!)
    if (time === undefined || time < previousTime) return { text }
    times.push(time)
    previousTime = time
  }

  const words: LyricWord[] = []
  const prefix = content.slice(0, tags[0]!.index)
  if (prefix)
    words.push({ text: prefix, startMs: lineStartMs, endMs: times[0] })
  tags.forEach((tag, index) => {
    const next = tags[index + 1]
    const word = content.slice(tag.index + tag[0].length, next?.index)
    if (!word) return
    words.push({
      text: word,
      startMs: times[index]!,
      ...(next ? { endMs: times[index + 1] } : {}),
    })
  })
  // 仅修剪整行两端的空白，词内空格与 Unicode 字素保持原样。
  const first = words.findIndex(word => word.text.trim())
  if (first === -1) return { text }
  let last = words.length - 1
  while (!words[last]!.text.trim()) last--
  const visibleWords = words.slice(first, last + 1)
  visibleWords[0]!.text = visibleWords[0]!.text.trimStart()
  visibleWords[visibleWords.length - 1]!.text =
    visibleWords[visibleWords.length - 1]!.text.trimEnd()
  return { text, words: visibleWords }
}

function safeWordTimes(word: LyricWord, offset = 0): boolean {
  return (
    Number.isSafeInteger(word.startMs + offset) &&
    (word.endMs === undefined || Number.isSafeInteger(word.endMs + offset))
  )
}

/** 时间单位固定为毫秒；支持 Enhanced LRC、重复行标签、offset 与 BOM。 */
export function parseLrc(text: string): LyricLine[] {
  const rawOffset = Number(text.match(/\[offset:\s*([+-]?\d+)\s*\]/i)?.[1] ?? 0)
  const offset = Number.isSafeInteger(rawOffset) ? rawOffset : 0
  const lines: LyricLine[] = []
  text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const stamps = [
        ...line.matchAll(/\[(\d+:\d{1,2}(?:[.:]\d{1,3})?)\]/g),
      ].flatMap((stamp, stampIndex) => {
        const startMs = timestampMs(stamp[1]!)
        return startMs === undefined ? [] : [{ startMs, stampIndex }]
      })
      const firstStamp = stamps[0]
      if (!firstStamp) return
      const content = line.replace(/\[[^\]]*\]/g, '').trim()
      const lyrics = enhancedLyrics(content, firstStamp.startMs)
      if (!lyrics.text) return
      stamps.forEach(({ startMs, stampIndex }) => {
        const words = lyrics.words?.map(word => ({
          text: word.text,
          startMs: startMs + (word.startMs - firstStamp.startMs),
          ...(word.endMs === undefined
            ? {}
            : { endMs: startMs + (word.endMs - firstStamp.startMs) }),
        }))
        lines.push({
          id: `${index}-${stampIndex}`,
          startMs,
          text: lyrics.text,
          ...(words?.every(word => safeWordTimes(word)) ? { words } : {}),
        })
      })
    })
  // 任一平移结果溢出时整份文件忽略 offset，避免行间失步或毫秒边界折叠。
  const applyOffset =
    offset !== 0 &&
    lines.every(
      line =>
        Number.isSafeInteger(line.startMs + offset) &&
        (!line.words || line.words.every(word => safeWordTimes(word, offset)))
    )
  if (applyOffset) {
    for (const line of lines) {
      line.startMs = Math.max(0, line.startMs + offset)
      for (const word of line.words ?? []) {
        word.startMs = Math.max(0, word.startMs + offset)
        if (word.endMs !== undefined)
          word.endMs = Math.max(0, word.endMs + offset)
      }
    }
  }
  return lines.sort((left, right) => left.startMs - right.startMs)
}

export function lyricIndexAt(
  lines: readonly LyricLine[],
  positionMs: number
): number {
  let low = 0
  let high = lines.length - 1
  let result = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (lines[mid]!.startMs <= positionMs) {
      result = mid
      low = mid + 1
    } else high = mid - 1
  }
  return result
}
export function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
