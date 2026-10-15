// Only for the you who has yet to exist in this world.
// 上面这行是上游作者在 claddagh/VisualizerCladdagh.tsx 开头的题献，随移植保留。
//
// Adapted from Folia claddagh/VisualizerCladdagh.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import type { Line } from '../../lyrics/folia/model'
import { buildLineGraphemeTimeline } from '../../lyrics/folia/graphemeTiming'
import { buildWordColorRanges } from '../../lyrics/folia/wordColoring'
import type { Theme } from '../../theme/model'
import {
  resolveThemeFontStack,
  resolveThemeFontWeight,
} from '../../theme/fontStacks'
import { clamp01 } from '../easing'

// Claddagh：歌词贴在一个倾斜的椭圆环上旋转，当前字转到正前方并发光。
// 这里是纯几何与时序部分：字符测量、弧长分布、时间轴补齐、分数索引。

export interface CladdaghTuning {
  /** 聚焦字的额外放大比例。 */
  focusScaleRatio: number
  /** 环半径相对舞台宽度的倍率。 */
  radiusScale: number
  /** 椭圆长轴相对屏幕的倾角（度）。 */
  ellipseTiltDeg: number
  showAxisLine: boolean
  /** 额外的字间距（px），逐字间隙累加。 */
  letterSpacingOffset: number
}

export const DEFAULT_CLADDAGH_TUNING: CladdaghTuning = {
  focusScaleRatio: 0.65,
  radiusScale: 1,
  ellipseTiltDeg: 45,
  showAxisLine: true,
  letterSpacingOffset: 0,
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))
const finiteOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function resolveCladdaghTuning(tuning?: unknown): CladdaghTuning {
  const source = (tuning ?? {}) as Partial<CladdaghTuning>
  return {
    focusScaleRatio: clamp(
      finiteOr(source.focusScaleRatio, DEFAULT_CLADDAGH_TUNING.focusScaleRatio),
      0,
      2
    ),
    radiusScale: clamp(
      finiteOr(source.radiusScale, DEFAULT_CLADDAGH_TUNING.radiusScale),
      0.4,
      2
    ),
    ellipseTiltDeg: clamp(
      finiteOr(source.ellipseTiltDeg, DEFAULT_CLADDAGH_TUNING.ellipseTiltDeg),
      0,
      90
    ),
    showAxisLine: source.showAxisLine ?? DEFAULT_CLADDAGH_TUNING.showAxisLine,
    letterSpacingOffset: clamp(
      finiteOr(
        source.letterSpacingOffset,
        DEFAULT_CLADDAGH_TUNING.letterSpacingOffset
      ),
      -20,
      60
    ),
  }
}

/** 整句的视觉长度：CJK 记 1，半角记 0.5。用于长句之间的重叠缓解。 */
export function getVisualLength(text: string): number {
  if (!text) return 0
  let score = 0
  for (const char of text) score += isCJKChar(char) ? 1 : 0.5
  return score
}

export const isCJKChar = (char: string): boolean => /[一-龥぀-ヿ가-힯]/.test(char)

/** 环最多能占的弧长（弧度）。超出就整体压缩。 */
export const CLADDAGH_MAX_ARC_SPAN = 4.25
const CLADDAGH_LETTER_SPACING_EM = 0.04
const CLADDAGH_BASE_TRACKING_EM = 0.18
export const CLADDAGH_BACK_FOLLOW_RATIO = 0.28
export const CLADDAGH_BACK_ORBIT_FOLLOW_RATIO = 0.52
/** 下一行提前入场的时间，也用于把当前行的渲染终点延到间奏里。 */
export const CLADDAGH_NEXT_LINE_ENTRY_LEAD_SECONDS = 0.34
const SPACING_CACHE_LIMIT = 240
const spacingCache = new Map<string, number[]>()

const fallbackGraphemeWidth = (char: string, fontPx: number): number => {
  if (/^\s+$/.test(char)) return fontPx * 0.36
  if (isCJKChar(char)) return fontPx
  return fontPx * 0.62
}

export interface CladdaghTimelineItem {
  char: string
  startTime: number
  endTime: number
}

/**
 * 把零时长的间隙字符（空格、未计时标点）摊成可见的时长。
 *
 * 每个间隙字符至少 60ms；不够时从相邻字符借，但借完后相邻字符本身不得少于 40ms ——
 * 否则为了把空格摊开反而把真正唱出来的字压没了。
 */
export function adjustCladdaghTimeline<
  T extends { startTime: number; endTime: number },
>(timeline: T[], line: { startTime: number; endTime: number }): T[] {
  if (!timeline.length) return timeline
  const adjusted = timeline.map(item => ({ ...item }))
  const total = adjusted.length
  let index = 0
  while (index < total) {
    if (adjusted[index]!.startTime !== adjusted[index]!.endTime) {
      index += 1
      continue
    }
    let end = index
    while (end < total && adjusted[end]!.startTime === adjusted[end]!.endTime)
      end += 1
    const gapCount = end - index
    let gapStart = index > 0 ? adjusted[index - 1]!.endTime : line.startTime
    let gapEnd = end < total ? adjusted[end]!.startTime : line.endTime
    const minNeeded = gapCount * 0.06
    let duration = gapEnd - gapStart
    if (duration < minNeeded) {
      const deficit = minNeeded - duration
      const stealable = (item: { startTime: number; endTime: number }) =>
        Math.max(0, item.endTime - item.startTime - 0.04)
      if (index > 0 && end < total) {
        const half = deficit / 2
        const prevSteal = Math.min(half, stealable(adjusted[index - 1]!))
        const nextSteal = Math.min(
          deficit - prevSteal,
          stealable(adjusted[end]!)
        )
        gapStart -= prevSteal
        gapEnd += nextSteal
        adjusted[index - 1]!.endTime = gapStart
        adjusted[end]!.startTime = gapEnd
      } else if (index > 0) {
        const prevSteal = Math.min(deficit, stealable(adjusted[index - 1]!))
        gapStart -= prevSteal
        adjusted[index - 1]!.endTime = gapStart
      } else if (end < total) {
        const nextSteal = Math.min(deficit, stealable(adjusted[end]!))
        gapEnd += nextSteal
        adjusted[end]!.startTime = gapEnd
      }
      duration = gapEnd - gapStart
    }
    const unit = duration > 0 ? duration / gapCount : 0
    for (let slot = index; slot < end; slot += 1) {
      const offset = slot - index
      adjusted[slot]!.startTime = gapStart + unit * offset
      adjusted[slot]!.endTime = gapStart + unit * (offset + 1)
    }
    index = end
  }
  return adjusted
}

/**
 * 当前时间对应的**分数**字符索引，字符之间平滑插值。
 *
 * 越过最后一个字之后仍允许继续外推（上游称 overshoot），否则环会在句末卡住；
 * 有 renderEnd 时按它铺满剩余时间，没有时按最后一步的步长外推、最多 1.8 个字宽。
 */
export function getFractionalActiveIndex(
  timeline: { startTime: number; endTime: number }[],
  timeSec: number,
  renderEnd?: number
): number {
  if (!timeline.length) return 0
  if (timeline.length === 1) {
    const item = timeline[0]!
    const end = Number.isFinite(renderEnd) ? renderEnd! : item.endTime
    const duration = Math.max(0.2, end - item.startTime)
    if (timeSec <= item.startTime) return 0
    return (timeSec - item.startTime) / duration
  }
  if (timeSec <= timeline[0]!.startTime) return 0
  const last = timeline.length - 1
  if (timeSec >= timeline[last]!.startTime) {
    const item = timeline[last]!
    if (Number.isFinite(renderEnd) && renderEnd! > item.startTime) {
      const progress = clamp01(
        (timeSec - item.startTime) / (renderEnd! - item.startTime)
      )
      return last + progress * 2
    }
    const previous = timeline[last - 1]!
    const own = item.endTime - item.startTime
    const gap = item.startTime - previous.startTime
    const step = own > 0 ? own : gap > 0 ? gap : 0.5
    return last + Math.min((timeSec - item.startTime) / step, 1.8)
  }
  for (let index = 0; index < timeline.length - 1; index += 1) {
    const start = timeline[index]!.startTime
    const next = timeline[index + 1]!.startTime
    if (timeSec >= start && timeSec < next) {
      if (next === start) return index
      return index + (timeSec - start) / (next - start)
    }
  }
  return timeline.length - 1
}

/** 让切线旋转保持可读，不出现倒置的字。 */
export function normalizeReadableAngle(degrees: number): number {
  let value = degrees
  while (value > 90) value -= 180
  while (value < -90) value += 180
  return value
}

function rememberSpacing(key: string, offsets: number[]): number[] {
  if (spacingCache.size >= SPACING_CACHE_LIMIT) {
    const oldest = spacingCache.keys().next().value
    if (oldest !== undefined) spacingCache.delete(oldest)
  }
  spacingCache.set(key, offsets)
  return offsets
}

function measureTextWidth(
  text: string,
  fontSpec: string,
  fontPx: number,
  fallback: number
): number {
  if (!text) return 0
  try {
    const prepared = prepareWithSegments(text, fontSpec, {
      whiteSpace: 'pre-wrap',
      letterSpacing: fontPx * CLADDAGH_LETTER_SPACING_EM,
    })
    const width = measureNaturalWidth(prepared)
    return Number.isFinite(width) && width > 0 ? width : fallback
  } catch {
    // 字体未就绪或无测量能力时按字宽估算，不要让整环排版失败。
    return fallback
  }
}

/** 用 pretext 的画布测量把字素中心放在它们真实的推进位置上。 */
export function measureCladdaghGraphemeOffsets(
  graphemes: string[],
  fontSpec: string,
  fontPx: number,
  letterSpacingOffsetPx = 0
): number[] {
  const text = graphemes.join('')
  const key = `${fontPx}|${fontSpec}|${CLADDAGH_BASE_TRACKING_EM}|${letterSpacingOffsetPx}|${text}`
  const cached = spacingCache.get(key)
  if (cached) return cached
  const offsets = new Array<number>(graphemes.length + 1).fill(0)
  let fallback = 0
  for (let index = 1; index <= graphemes.length; index += 1) {
    fallback += fallbackGraphemeWidth(graphemes[index - 1]!, fontPx)
    const tracking = (index - 1) * fontPx * CLADDAGH_BASE_TRACKING_EM
    const extra = (index - 1) * letterSpacingOffsetPx
    offsets[index] = Math.max(
      offsets[index - 1]!,
      measureTextWidth(
        graphemes.slice(0, index).join(''),
        fontSpec,
        fontPx,
        fallback
      ) +
        tracking +
        extra
    )
  }
  return rememberSpacing(key, offsets)
}

export interface CladdaghSpacingItem extends CladdaghTimelineItem {
  /** 该字素中心对应的弧度（未居中）。 */
  startAngle: number
  /** 居中并压缩后的标称角度，环的排布以它为准。 */
  nominalAngle: number
  /** 整句超出最大弧长时的压缩系数。 */
  scaleFactor: number
  /** 关键字着色命中的颜色；没命中为 null。 */
  charColor: string | null
}

/**
 * 把字素按测量宽度分布到弧上并居中。
 * 整句超过 CLADDAGH_MAX_ARC_SPAN 时整体压缩，避免长句绕成一圈自相重叠。
 */
export function buildCladdaghSpacing(
  items: (CladdaghTimelineItem & { charColor: string | null })[],
  fontSpec: string,
  fontPx: number,
  radiusPx: number,
  spacingScale = 1,
  letterSpacingOffsetPx = 0
): CladdaghSpacingItem[] {
  if (!items.length) return []
  const offsets = measureCladdaghGraphemeOffsets(
    items.map(item => item.char),
    fontSpec,
    fontPx,
    letterSpacingOffsetPx
  )
  const safeScale = Number.isFinite(spacingScale)
    ? Math.max(0.1, spacingScale)
    : 1
  const totalWidth = (offsets[offsets.length - 1] ?? 0) * safeScale
  // 半径至少两个字高，避免极窄舞台下角度爆炸。
  const safeRadius = Math.max(radiusPx, fontPx * 2, 1)
  const totalSpan = totalWidth / safeRadius
  const scaleFactor =
    totalSpan > CLADDAGH_MAX_ARC_SPAN ? CLADDAGH_MAX_ARC_SPAN / totalSpan : 1
  return items.map((item, index) => {
    const centerPx =
      (((offsets[index] ?? 0) + (offsets[index + 1] ?? offsets[index] ?? 0)) /
        2) *
      safeScale
    const startAngle = centerPx / safeRadius
    return {
      ...item,
      startAngle,
      nominalAngle: (startAngle - totalSpan / 2) * scaleFactor,
      scaleFactor,
    }
  })
}

/** 整句的字素时间轴 + 关键字着色，按环的要求补齐间隙时长。 */
export function buildCladdaghTimeline(
  line: Line,
  wordColors: Theme['wordColors']
): (CladdaghTimelineItem & { charColor: string | null })[] {
  const timeline = adjustCladdaghTimeline(buildLineGraphemeTimeline(line), line)
  const ranges = buildWordColorRanges(line.fullText, wordColors)
  let cursor = 0
  return timeline.map(item => {
    const start = cursor
    const end = cursor + item.char.length
    cursor = end
    const matched = ranges.find(
      range => start < range.endOffset && range.startOffset < end
    )
    return {
      char: item.char,
      startTime: item.startTime,
      endTime: item.endTime,
      charColor: matched ? matched.color : null,
    }
  })
}

/** 环当前转到的角度：由分数索引在标称角度之间插值，越过末字继续按步长外推。 */
export function getLineWordOffset(
  spacing: { nominalAngle: number; startTime: number; endTime: number }[],
  timeSec: number,
  renderEnd?: number
): number {
  if (!spacing.length) return 0
  const fractional = getFractionalActiveIndex(spacing, timeSec, renderEnd)
  const last = spacing.length - 1
  if (fractional <= last) {
    const whole = Math.floor(fractional)
    const fraction = fractional - whole
    const from = spacing[whole]?.nominalAngle ?? 0
    const to = spacing[Math.min(whole + 1, last)]?.nominalAngle ?? 0
    return from + (to - from) * fraction
  }
  const lastAngle = spacing[last]?.nominalAngle ?? 0
  const previousAngle = spacing[Math.max(0, last - 1)]?.nominalAngle ?? 0
  return lastAngle + (lastAngle - previousAngle) * (fractional - last)
}

/** 整行的播放进度 0..1，用于背面跟随量。 */
export function getLinePlaybackProgress(
  spacing: { nominalAngle: number; startTime: number; endTime: number }[],
  timeSec: number,
  renderEnd?: number
): number {
  if (!spacing.length) return 0
  if (spacing.length === 1) {
    const item = spacing[0]!
    const end = Number.isFinite(renderEnd) ? renderEnd! : item.endTime
    return clamp01(
      (timeSec - item.startTime) / Math.max(0.001, end - item.startTime)
    )
  }
  return clamp01(
    getFractionalActiveIndex(spacing, timeSec, renderEnd) /
      Math.max(1, spacing.length - 1)
  )
}

/**
 * 某一行的渲染终点：取 renderHints 与「下一行开始前留出入场时间」中的较晚者。
 * 这样间奏期间环会继续缓慢漂移，而不是停住。
 */
export function claddaghLineRenderEnd(
  lines: Line[],
  index: number
): number | undefined {
  const line = lines[index]
  if (!line) return undefined
  const next = lines[index + 1]
  return Math.max(
    line.renderHints?.renderEndTime ?? line.endTime,
    next
      ? next.startTime - CLADDAGH_NEXT_LINE_ENTRY_LEAD_SECONDS
      : line.endTime + 10
  )
}

/** 字体规格。环的所有测量都用它，必须与最终渲染一致，否则弧长会偏。 */
export function claddaghFontSpec(
  theme: Theme,
  lyricsFontScale: number
): { fontSpec: string; fontPx: number; fontStack: string; fontWeight: number } {
  const fontStack = resolveThemeFontStack(theme)
  const fontPx = 72 * lyricsFontScale
  const fontWeight = resolveThemeFontWeight(theme, 700)
  return {
    fontStack,
    fontPx,
    fontWeight,
    fontSpec: `${fontWeight} ${fontPx}px ${fontStack}`,
  }
}

/** 环半径。宽度的 44% 但不超过 560，再乘调参倍率。 */
export function claddaghRadius(
  stageWidth: number,
  radiusScale: number
): { rx: number; ry: number } {
  const rx =
    (stageWidth > 0 ? Math.min(stageWidth * 0.44, 560) : 360) * radiusScale
  // 45 度投影比。
  return { rx, ry: rx > 0 ? rx * 0.707 : 254 }
}

/** 聚焦放大会改变观感密度，所以字间距随它同步缩放。 */
export const claddaghSpacingScale = (focusScaleRatio: number) =>
  (1 + focusScaleRatio) / (1 + DEFAULT_CLADDAGH_TUNING.focusScaleRatio)

/**
 * 播放位置被重置到开头（Seek 回 0 或换歌）时，是否应该保留已完成的那一帧。
 *
 * 上游记录的原因：时间源会在 React 提交新的行索引**之前**就归零，
 * 那一瞬间会用「旧的最后一行 + 时间 0」渲染出错误画面。
 */
export const shouldHoldCladdaghFrame = (
  previousTimeSec: number,
  currentTimeSec: number,
  centerLineIndex: number
) =>
  centerLineIndex > 0 &&
  currentTimeSec <= 0.5 &&
  currentTimeSec < previousTimeSec - 0.5
