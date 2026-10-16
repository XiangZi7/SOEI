// Absolute-time adaptation of Folia MonetWordSweep (AGPL-3.0).
import type { Line } from '../../lyrics/folia/model'
import type { MonetDisplayToken } from '../../lyrics/folia/monetLyricsModel'
import { resolveMonetFillWidth, resolveMonetGlow } from '../../lyrics/folia/monetLyricMotion'
import { resolveMonetSweepEdgeSoftness, resolveMonetSweepEnd } from '../../lyrics/folia/monetLyricsModel'
import { colorWithAlpha } from '../../theme/colorMath'

export function hasMeasuredMonetTiming(line: Line, token: MonetDisplayToken): boolean {
  return token.timed && token.startTime !== null && token.endTime !== null && line.words.some(word => !word.estimated && word.endTime > word.startTime && word.text === token.text && word.startTime === token.startTime && word.endTime === token.endTime)
}
export function monetSweepFrame(time: number, token: MonetDisplayToken, offsets: number[], fontPx: number, lineEnd: number, color: string, chorus = false, reducedMotion = false) {
  const start = token.startTime ?? 0, end = token.endTime ?? start
  const fill = resolveMonetFillWidth(time, start, end, offsets, token.graphemeTimings)
  const softness = resolveMonetSweepEdgeSoftness(fontPx)
  const edge = resolveMonetSweepEnd(fill, offsets[offsets.length - 1] ?? 0, softness)
  const glow = reducedMotion ? 0 : resolveMonetGlow(time, start, end, lineEnd)
  return {
    passed: time >= end,
    mask: 'linear-gradient(90deg,#000 ' + Math.max(edge - softness, 0) + 'px,transparent ' + Math.max(edge, 0) + 'px)',
    glow: glow > 0.001 ? 'drop-shadow(0 0 ' + Math.round(fontPx * (chorus ? 0.18 : 0.112)) + 'px ' + colorWithAlpha(color, glow * 0.88) + ') drop-shadow(0 0 ' + Math.round(fontPx * (chorus ? 0.36 : 0.26)) + 'px ' + colorWithAlpha(color, glow * 0.62) + ')' : 'none',
  }
}
