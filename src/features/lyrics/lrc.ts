import type { LyricLine } from '../../types/music'

/** 时间单位固定为毫秒；支持重复时间标签、offset、BOM 与无序标签。 */
export function parseLrc(text: string): LyricLine[] {
  const offset = Number(text.match(/\[offset:\s*([+-]?\d+)\s*\]/i)?.[1] ?? 0)
  const lines: LyricLine[] = []
  text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const stamps = [
        ...line.matchAll(/\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g),
      ]
      const content = line.replace(/\[[^\]]*\]/g, '').trim()
      if (!content) return
      stamps.forEach((stamp, stampIndex) => {
        const seconds = Number(stamp[2])
        if (seconds >= 60) return
        const fraction = Number((stamp[3] ?? '').padEnd(3, '0'))
        lines.push({
          id: `${index}-${stampIndex}`,
          startMs: Math.max(
            0,
            Number(stamp[1]) * 60000 + seconds * 1000 + fraction + offset
          ),
          text: content,
        })
      })
    })
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
