import type { PlaybackSnapshot } from '../../types/music'

const MAX_EXTRAPOLATION_MS = 500

/** 只外推最近一次真实进度，原生停止上报时最多继续 500ms。 */
export function projectLyricPosition(
  snapshot: Pick<PlaybackSnapshot, 'positionMs' | 'durationMs' | 'status'>,
  elapsedMs: number
): number {
  const duration =
    Number.isFinite(snapshot.durationMs) && snapshot.durationMs > 0
      ? snapshot.durationMs
      : Infinity
  const position = Number.isFinite(snapshot.positionMs)
    ? Math.max(0, snapshot.positionMs)
    : 0
  const elapsed =
    snapshot.status === 'playing' && Number.isFinite(elapsedMs)
      ? Math.max(0, Math.min(MAX_EXTRAPOLATION_MS, elapsedMs))
      : 0
  return Math.min(duration, position + elapsed)
}
