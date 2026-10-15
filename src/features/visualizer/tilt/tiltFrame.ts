// Adapted from Folia tilt/VisualizerTilt.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import type { Line } from '../../lyrics/folia/model'
import { getLineRenderEndTime } from '../../lyrics/folia/renderHints'
import { clamp01, easing, lerp } from '../easing'
import type { TiltCharTiming } from './tiltLayout'

// tilt 的逐帧求值。与 classic 一样走绝对时间：Seek 直接求当前帧，不重演入场。

/** 段落提前 0.25 秒开始显现，给入场动画留出时间。 */
const SEGMENT_LEAD_SEC = 0.25
/** 整行开始前 0.1 秒之内仍算未开始。 */
const LINE_LEAD_SEC = 0.1
/** 上游全部入场都用这条曲线。 */
const REVEAL_EASE = easing(0.25, 0.46, 0.45, 0.94)
const SEGMENT_REVEAL_SEC = { normal: 0.55, tilt: 0.6 } as const
const CHAR_REVEAL_SEC = 0.5
const CHAR_STAGGER_SEC = { normal: 0.04, tilt: 0.05 } as const

/**
 * 字符脉冲强度 0..1：唱到时半个正弦峰，之后留 0.25 的余晖。
 * 时长夹在 0.2..0.9 秒，所以极短的词不会闪一下就过、极长的词也不会一直撑满。
 */
export function tiltCharPulse(timeSec: number, timing: TiltCharTiming): number {
  const rawDuration = Math.max(timing.endTime - timing.startTime, 0.05)
  const duration = Math.min(Math.max(rawDuration, 0.2), 0.9)
  const elapsed = timeSec - timing.startTime
  if (elapsed < 0) return 0
  if (elapsed <= duration) return Math.sin((elapsed / duration) * Math.PI)
  const afterglowRamp = duration * 1.2
  const after = elapsed - duration
  if (after >= afterglowRamp) return 0.25
  return 0.25 * (after / afterglowRamp)
}

/**
 * 当前应显现到第几段（-1 表示整行都还没开始或已结束）。
 * 段落按时间顺序累积显现，而不是一次全亮。
 */
export function tiltVisibleSegmentIndex(
  timeSec: number,
  segmentTimings: { start: number; end: number }[],
  line: Line | null
): number {
  if (!line || !segmentTimings.length) return -1
  if (
    timeSec < line.startTime - LINE_LEAD_SEC ||
    timeSec > getLineRenderEndTime(line)
  )
    return -1
  let index = -1
  for (let position = 0; position < segmentTimings.length; position += 1)
    if (timeSec >= segmentTimings[position]!.start - SEGMENT_LEAD_SEC)
      index = position
  return index
}

/** 字符脉冲带来的缩放。斜体行幅度略大。 */
export const tiltCharScale = (intensity: number, isTilt: boolean): number =>
  1 + intensity * (isTilt ? 0.18 : 0.15)

/** 段落开始显现的绝对时刻。 */
export const tiltSegmentRevealStart = (segmentStart: number): number =>
  segmentStart - SEGMENT_LEAD_SEC

export interface TiltSegmentFrame {
  opacity: number
  translateY: number
  scale: number
}

/**
 * 段落容器的入场帧。`visible` 为假时停在入场前的姿态 ——
 * 这样回拖到该段之前，画面就是它还没出现的样子，而不是残留。
 */
export function tiltSegmentFrame(
  timeSec: number,
  segmentStart: number,
  visible: boolean,
  isTilt: boolean
): TiltSegmentFrame {
  const fromY = isTilt ? 24 : 20
  const fromScale = isTilt ? 0.92 : 1
  if (!visible) return { opacity: 0, translateY: fromY, scale: fromScale }
  const duration = isTilt ? SEGMENT_REVEAL_SEC.tilt : SEGMENT_REVEAL_SEC.normal
  const progress = REVEAL_EASE(
    clamp01((timeSec - tiltSegmentRevealStart(segmentStart)) / duration)
  )
  return {
    opacity: progress,
    translateY: lerp(fromY, 0, progress),
    scale: lerp(fromScale, 1, progress),
  }
}

export interface TiltCharFrame {
  opacity: number
  translateY: number
  scale: number
}

/**
 * 单个字素的帧。入场按字序错开（normal 40ms、tilt 50ms 一个），
 * 斜体行另有上下交替的驻留偏移；脉冲缩放叠加在入场之上。
 *
 * `charIndex` 必须是**非空白**字素的序号：空白不参与错开，否则句中有空格时
 * 后半句会整体晚一拍。
 */
export function tiltCharFrame({
  timeSec,
  segmentStart,
  charIndex,
  visible,
  isTilt,
  pulse,
  staggerOffset,
}: {
  timeSec: number
  segmentStart: number
  charIndex: number
  visible: boolean
  isTilt: boolean
  pulse: number
  /** 斜体行的驻留偏移量（px），正负由字序交替决定。 */
  staggerOffset: number
}): TiltCharFrame {
  const restY = isTilt ? staggerOffset : 0
  const fromY = isTilt ? staggerOffset * 2 : 0
  if (!visible) return { opacity: 0, translateY: fromY, scale: 1 }
  const delay =
    charIndex * (isTilt ? CHAR_STAGGER_SEC.tilt : CHAR_STAGGER_SEC.normal)
  const elapsed = timeSec - tiltSegmentRevealStart(segmentStart) - delay
  const progress = REVEAL_EASE(clamp01(elapsed / CHAR_REVEAL_SEC))
  return {
    opacity: progress,
    translateY: lerp(fromY, restY, progress),
    scale: tiltCharScale(pulse, isTilt),
  }
}
