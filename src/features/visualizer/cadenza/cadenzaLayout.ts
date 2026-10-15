// Adapted from Folia cadenza/VisualizerCadenza.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import {
  layoutWithLines,
  prepareWithSegments,
  type LayoutCursor,
  type LayoutLine,
  type LayoutLinesResult,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'
import type { Line, Word } from '../../lyrics/folia/model'
import {
  buildWordGraphemeTimings,
  splitLyricGraphemes,
  type GraphemeTiming,
} from '../../lyrics/folia/graphemeTiming'
import { resolveWordColor } from '../../lyrics/folia/wordColoring'
import type { Theme } from '../../theme/model'
import {
  resolveThemeFontStack,
  resolveThemeFontWeight,
} from '../../theme/fontStacks'
import { resolveCadenzaLineTiming } from './cadenzaTiming'

// cadenza 的重排版管线。
//
// 一行歌词不是直接出现再动起来的：先整行交给 pretext 测量换行，
// 把换行结果切成「片段」，再把片段变成带碰撞回避的视觉对象（placement）。
// 之后的逐帧渲染只消费 placement，不再碰文本。
//
// 所以这里出问题的话，画面症状通常是「字叠在一起」或「发光落在错误的文字上」，
// 对应的就是 placement 阶段或 word→字素映射阶段。

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

/** 上游 isCJK：整串里只要含中日韩字符就算。用于行高与是否逐字发光。 */
const containsCJK = (text: string) => /[一-龥぀-ヿ가-힯]/.test(text)

export interface CadenzaTuning {
  fontScale: number
  widthRatio: number
  motionAmount: number
  glowIntensity: number
}

// 上游还有一个 `beamIntensity`，默认 0，且它唯一的消费者 `drawActiveBeam`
// 在最终版本里已经不再被调用（见 NOTICE）。这里不保留这个无效开关。
export const DEFAULT_CADENZA_TUNING: CadenzaTuning = {
  fontScale: 1.12,
  widthRatio: 0.72,
  motionAmount: 1,
  glowIntensity: 1,
}

const numeric = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function resolveCadenzaTuning(raw?: unknown): CadenzaTuning {
  const input = (raw ?? {}) as Partial<CadenzaTuning>
  return {
    fontScale: clamp(numeric(input.fontScale, 1.12), 0.5, 2),
    widthRatio: clamp(numeric(input.widthRatio, 0.72), 0.3, 1),
    motionAmount: clamp(numeric(input.motionAmount, 1), 0, 2.5),
    glowIntensity: clamp(numeric(input.glowIntensity, 1), 0, 2.5),
  }
}

/** 字号由舞台宽度定基准，再按字素数与词数两个维度扣减，避免长句溢出。 */
export function chooseCadenzaFontPx(stageWidth: number, line: Line): number {
  const graphemeCount = splitLyricGraphemes(line.fullText).length || 1
  const wordCount = line.words.length || 1
  const widthBase = clamp(stageWidth * 0.086, 34, 94)
  const lengthPenalty =
    graphemeCount > 12 ? Math.min((graphemeCount - 12) * 1.8, 34) : 0
  const densityPenalty = wordCount > 7 ? Math.min((wordCount - 7) * 1.5, 18) : 0
  return clamp(widthBase - lengthPenalty - densityPenalty, 28, 104)
}

export function buildCadenzaFont(theme: Theme, fontPx: number): string {
  return `${resolveThemeFontWeight(theme, 700)} ${fontPx}px ${resolveThemeFontStack(theme)}`
}

export interface CadenzaSegmentMeta {
  graphemeStart: number
  graphemeEnd: number
  graphemeCount: number
}

/**
 * pretext 以 segment 为单位工作，动画逻辑想要的是全局字素下标。
 * 这个桥让两套坐标系可以互相换算。
 */
export function buildCadenzaSegmentMetas(prepared: PreparedTextWithSegments): {
  segmentMetas: CadenzaSegmentMeta[]
  graphemes: string[]
} {
  const segmentMetas: CadenzaSegmentMeta[] = []
  const graphemes: string[] = []
  let cursor = 0
  for (const segment of prepared.segments) {
    const segmentGraphemes = splitLyricGraphemes(segment)
    segmentMetas.push({
      graphemeStart: cursor,
      graphemeEnd: cursor + segmentGraphemes.length,
      graphemeCount: segmentGraphemes.length,
    })
    graphemes.push(...segmentGraphemes)
    cursor += segmentGraphemes.length
  }
  return { segmentMetas, graphemes }
}

export interface CadenzaWordRange {
  wordIndex: number
  word: Word
  start: number
  end: number
  color: string
  graphemeTimings: GraphemeTiming[]
}

/**
 * 把歌词的词重新映射回 pretext 分段后的字素流。
 * 这一步错了，发光与高亮就会落到错误的文字切片上。
 * 匹配失败时退回「游标处 + 词长」，保证区间不重叠也不越界。
 */
export function findCadenzaWordRanges(
  line: Line,
  graphemes: string[],
  theme: Theme
): CadenzaWordRange[] {
  const ranges: CadenzaWordRange[] = []
  let cursor = 0
  for (let wordIndex = 0; wordIndex < line.words.length; wordIndex += 1) {
    const word = line.words[wordIndex]!
    const target = splitLyricGraphemes(word.text)
    let start = -1
    for (let i = cursor; i <= graphemes.length - target.length; i += 1) {
      let isMatch = true
      for (let j = 0; j < target.length; j += 1)
        if (graphemes[i + j] !== target[j]) {
          isMatch = false
          break
        }
      if (isMatch) {
        start = i
        break
      }
    }
    if (start === -1) start = clamp(cursor, 0, graphemes.length)
    const end = clamp(start + target.length, start, graphemes.length)
    ranges.push({
      wordIndex,
      word,
      start,
      end,
      color: resolveWordColor(word.text, theme.wordColors, theme.accentColor),
      graphemeTimings: buildWordGraphemeTimings(word),
    })
    cursor = end
  }
  return ranges
}

function cursorToGlobalOffset(
  cursor: LayoutCursor,
  segmentMetas: CadenzaSegmentMeta[]
): number {
  if (segmentMetas.length === 0) return 0
  const segment = segmentMetas[cursor.segmentIndex]
  if (!segment) return segmentMetas[segmentMetas.length - 1]!.graphemeEnd
  return clamp(
    segment.graphemeStart + cursor.graphemeIndex,
    segment.graphemeStart,
    segment.graphemeEnd
  )
}

/**
 * 一个 segment 内部的部分宽度。
 * pretext 给了可断行处的逐字素推进量，有就精确求和；
 * 没有就按字素数等比例分摊整段宽度。
 */
function getPartialSegmentWidth(
  prepared: PreparedTextWithSegments,
  segmentIndex: number,
  meta: CadenzaSegmentMeta,
  startOffset: number,
  endOffset: number
): number {
  const localStart = clamp(
    startOffset - meta.graphemeStart,
    0,
    meta.graphemeCount
  )
  const localEnd = clamp(endOffset - meta.graphemeStart, 0, meta.graphemeCount)
  if (localEnd <= localStart) return 0
  if (localStart === 0 && localEnd === meta.graphemeCount)
    return prepared.widths[segmentIndex] ?? 0
  const advances = prepared.breakableFitAdvances[segmentIndex]
  if (advances && advances.length > 0) {
    let width = 0
    for (let i = localStart; i < localEnd; i += 1) width += advances[i] ?? 0
    return width
  }
  const fullWidth = prepared.widths[segmentIndex] ?? 0
  if (meta.graphemeCount === 0) return fullWidth
  return fullWidth * ((localEnd - localStart) / meta.graphemeCount)
}

/** 两个全局字素偏移之间的渲染宽度。 */
export function cadenzaWidthBetweenOffsets(
  prepared: PreparedTextWithSegments,
  segmentMetas: CadenzaSegmentMeta[],
  startOffset: number,
  endOffset: number
): number {
  if (endOffset <= startOffset) return 0
  let width = 0
  for (
    let segmentIndex = 0;
    segmentIndex < segmentMetas.length;
    segmentIndex += 1
  ) {
    const meta = segmentMetas[segmentIndex]!
    if (endOffset <= meta.graphemeStart) break
    if (startOffset >= meta.graphemeEnd) continue
    width += getPartialSegmentWidth(
      prepared,
      segmentIndex,
      meta,
      Math.max(startOffset, meta.graphemeStart),
      Math.min(endOffset, meta.graphemeEnd)
    )
  }
  return width
}

export interface CadenzaWordFragment {
  wordIndex: number
  lineIndex: number
  word: Word
  text: string
  color: string
  startX: number
  endX: number
  fragmentStartInWord: number
  wordGraphemeCount: number
  wordGraphemeTimings: GraphemeTiming[]
  fragmentIndexInWord: number
  isPrimaryFragment: boolean
  isSplitAcrossLines: boolean
}

export interface CadenzaLineView {
  line: LayoutLine
  lineStart: number
  lineEnd: number
  fragments: CadenzaWordFragment[]
}

/**
 * 换行后的版面行可能从一个歌词词的中间切过去。
 * 所以先按版面行切出片段，之后再判断哪些片段仍然「属于同一个词」。
 */
export function buildCadenzaLineFragments(
  prepared: PreparedTextWithSegments,
  segmentMetas: CadenzaSegmentMeta[],
  graphemes: string[],
  layout: LayoutLinesResult,
  ranges: CadenzaWordRange[]
): CadenzaLineView[] {
  const lineViews = layout.lines.map(line => {
    const lineStart = cursorToGlobalOffset(line.start, segmentMetas)
    const lineEnd = cursorToGlobalOffset(line.end, segmentMetas)
    const fragments = ranges.flatMap<CadenzaWordFragment>(range => {
      if (range.end <= lineStart || range.start >= lineEnd) return []
      const fragmentStart = Math.max(range.start, lineStart)
      const fragmentEnd = Math.min(range.end, lineEnd)
      return [
        {
          wordIndex: range.wordIndex,
          lineIndex: 0,
          word: range.word,
          text: graphemes.slice(fragmentStart, fragmentEnd).join(''),
          color: range.color,
          startX: cadenzaWidthBetweenOffsets(
            prepared,
            segmentMetas,
            lineStart,
            fragmentStart
          ),
          endX: cadenzaWidthBetweenOffsets(
            prepared,
            segmentMetas,
            lineStart,
            fragmentEnd
          ),
          fragmentStartInWord: fragmentStart - range.start,
          wordGraphemeCount: Math.max(range.end - range.start, 1),
          wordGraphemeTimings: range.graphemeTimings,
          fragmentIndexInWord: 0,
          isPrimaryFragment: true,
          isSplitAcrossLines: false,
        },
      ]
    })
    return { line, lineStart, lineEnd, fragments }
  })

  const fragmentCountByWord = new Map<number, number>()
  for (const lineView of lineViews)
    for (const fragment of lineView.fragments)
      fragmentCountByWord.set(
        fragment.wordIndex,
        (fragmentCountByWord.get(fragment.wordIndex) ?? 0) + 1
      )

  const seenByWord = new Map<number, number>()
  return lineViews.map((lineView, lineIndex) => ({
    ...lineView,
    fragments: lineView.fragments.map(fragment => {
      const countInWord = fragmentCountByWord.get(fragment.wordIndex) ?? 1
      const indexInWord = seenByWord.get(fragment.wordIndex) ?? 0
      seenByWord.set(fragment.wordIndex, indexInWord + 1)
      return {
        ...fragment,
        lineIndex,
        fragmentIndexInWord: indexInWord,
        isPrimaryFragment: indexInWord === 0,
        isSplitAcrossLines: countInWord > 1,
      }
    }),
  }))
}

/**
 * 选出整行的「主角词」并给它额外放大。
 *
 * 一个歌词词可能被换行切开（例如 "no-no" → "no-" + "no"）。
 * 这些片段不能都继承同一个居中的主角位置，否则会互相叠在一起 ——
 * 所以只有未被切开的首片段才有资格当候选。
 */
export function buildCadenzaEmphasisMap(
  lineViews: CadenzaLineView[],
  isInterlude: boolean
): Map<number, number> {
  const emphasisMap = new Map<number, number>()
  if (isInterlude) return emphasisMap

  const primaryFragments = lineViews
    .flatMap(lineView => lineView.fragments)
    .filter(fragment => fragment.isPrimaryFragment)

  const candidates = primaryFragments
    .filter(
      fragment =>
        !fragment.isSplitAcrossLines && fragment.text.trim().length > 0
    )
    .map(fragment => {
      const graphemeCount = Math.max(
        fragment.wordGraphemeCount,
        splitLyricGraphemes(fragment.word.text).length,
        1
      )
      // CJK 单字信息密度高，给固定权重；拉丁词按长度加权但有上限。
      const semanticWeight = containsCJK(fragment.word.text)
        ? 0.18
        : Math.min(graphemeCount * 0.08, 0.36)
      const centerBias =
        1 -
        Math.abs(fragment.wordIndex - (primaryFragments.length - 1) / 2) /
          Math.max(primaryFragments.length, 1)
      return { fragment, score: semanticWeight + centerBias * 0.18 }
    })
    .sort((a, b) => b.score - a.score)

  const hero = candidates[0]
  if (hero)
    emphasisMap.set(
      hero.fragment.wordIndex,
      1.46 * (1 + clamp(hero.score - 0.48, 0, 0.52))
    )
  return emphasisMap
}

export interface CadenzaPlacement {
  id: string
  wordIndex: number
  word: Word
  text: string
  color: string
  x: number
  y: number
  width: number
  height: number
  scale: number
  passedRotate: number
  passedDriftX: number
  passedDriftY: number
  fragmentStartInWord: number
  wordGraphemeCount: number
  wordGraphemeTimings: GraphemeTiming[]
  emphasis: number
  isInterlude: boolean
  /** 本片段的字素，渲染层按它建 span。 */
  graphemes: string[]
  /** 是否逐字发光：normal 模式 + 非 CJK + 多字素。 */
  splitGlow: boolean
  /** 文字相对 placement 锚点的偏移。几何与字形上伸量都不随时间变，prepare 期算一次。 */
  offsetX: number
  offsetY: number
}

interface CollisionRect {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * 片段在这里停止做文本切片，变成真正的动画视觉对象。
 * 之后的一切都是 placement 几何与各状态的运动数据。
 *
 * 位置用「从理想位置向外螺旋采样 + 矩形碰撞检测」决定：
 * 主角词想占中心，其余词被推开但尽量少走路（score = 重叠面积×2.2 + 位移）。
 */
export function buildCadenzaPlacements(
  lineViews: CadenzaLineView[],
  fontPx: number,
  lineHeight: number,
  maxWidth: number,
  animationIntensity: Theme['animationIntensity'],
  seed: number,
  isInterlude: boolean,
  splitGlow: boolean,
  /** 字形上伸量。默认按 0.78em 估算，渲染路径注入真实的 canvas 测量。 */
  measureAscent: (text: string) => number = () => fontPx * 0.78
): CadenzaPlacement[] {
  const totalHeight = Math.max(lineViews.length, 1) * lineHeight
  const baseMargin = animationIntensity === 'calm' ? 4 : 6
  const baseScale =
    animationIntensity === 'chaotic'
      ? 1.02
      : animationIntensity === 'calm'
        ? 1
        : 1.01
  const emphasisMap = buildCadenzaEmphasisMap(lineViews, isInterlude)
  const heroWordIndex =
    [...emphasisMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const placements: CadenzaPlacement[] = []
  // 碰撞结构：矩形列表 + 按垂直带分桶的空间哈希 + 查询标记（同一次查询里去重）。
  const occupiedRects: CollisionRect[] = []
  const occupiedBands = new Map<number, number[]>()
  const occupiedMarks: number[] = []
  let queryStamp = 0
  const bandSize = Math.max(24, Math.round(lineHeight * 0.9))
  const bandIndex = (value: number) => Math.floor(value / bandSize)

  const registerRect = (rect: CollisionRect) => {
    const rectIndex = occupiedRects.length
    occupiedRects.push(rect)
    for (
      let band = bandIndex(rect.top);
      band <= bandIndex(rect.bottom);
      band += 1
    ) {
      const bucket = occupiedBands.get(band)
      if (bucket) bucket.push(rectIndex)
      else occupiedBands.set(band, [rectIndex])
    }
  }

  const evaluateRect = (
    left: number,
    top: number,
    right: number,
    bottom: number
  ) => {
    if (occupiedRects.length === 0) return { intersects: false, overlapArea: 0 }
    queryStamp += 1
    const stamp = queryStamp
    let intersects = false
    let overlapArea = 0
    for (let band = bandIndex(top); band <= bandIndex(bottom); band += 1) {
      const bucket = occupiedBands.get(band)
      if (!bucket) continue
      for (const rectIndex of bucket) {
        // 跨多条带的矩形会被多次命中，用 stamp 去重。
        if (occupiedMarks[rectIndex] === stamp) continue
        occupiedMarks[rectIndex] = stamp
        const rect = occupiedRects[rectIndex]!
        const overlapWidth = Math.max(
          0,
          Math.min(right, rect.right) - Math.max(left, rect.left)
        )
        const overlapHeight = Math.max(
          0,
          Math.min(bottom, rect.bottom) - Math.max(top, rect.top)
        )
        if (overlapWidth <= 0 || overlapHeight <= 0) continue
        intersects = true
        overlapArea += overlapWidth * overlapHeight
      }
    }
    return { intersects, overlapArea }
  }

  const pushPlacementRect = (
    left: number,
    baselineY: number,
    width: number,
    height: number,
    padding: number
  ) =>
    registerRect({
      left: left - padding,
      top: baselineY - height - padding,
      right: left + width + padding,
      bottom: baselineY + padding,
    })

  // @note Version Control: Project Folia version 0.5.27-a16525c
  const plans = lineViews
    .flatMap((lineView, lineIndex) => {
      const lineLeft = -lineView.line.width / 2
      const baselineY = -totalHeight / 2 + fontPx + lineIndex * lineHeight
      return lineView.fragments.map((fragment, fragmentIndex) => {
        const emphasis = emphasisMap.get(fragment.wordIndex) ?? 1
        const width = Math.max(fragment.endX - fragment.startX, fontPx * 0.18)
        const scale = emphasis > 1 ? baseScale * emphasis : baseScale
        const height = fontPx * scale * 0.95
        return {
          fragment,
          lineIndex,
          fragmentIndex,
          baseX: lineLeft + fragment.startX,
          baseY: baselineY,
          emphasis,
          width,
          height,
          scale,
          collisionWidth: width * scale * (emphasis > 1 ? 1.48 : 1.26),
          collisionHeight: height * (emphasis > 1 ? 1.36 : 1.24),
          padding: baseMargin + (emphasis > 1 ? 10 : 2),
        }
      })
    })
    // 主角先占位，其余按版面顺序 —— 放置顺序决定谁被推开。
    .sort((a, b) => {
      const emphasisDelta = b.emphasis - a.emphasis
      if (Math.abs(emphasisDelta) > 0.001) return emphasisDelta
      if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex
      return a.fragment.startX - b.fragment.startX
    })

  const primaryPlanByWord = new Map<number, (typeof plans)[number]>()
  for (const plan of plans)
    if (!primaryPlanByWord.has(plan.fragment.wordIndex))
      primaryPlanByWord.set(plan.fragment.wordIndex, plan)

  const heroPlan =
    heroWordIndex === null
      ? null
      : (primaryPlanByWord.get(heroWordIndex) ?? null)
  const heroMetrics = heroPlan
    ? {
        centerX: (heroPlan.width * heroPlan.scale) / 2,
        centerY: -heroPlan.height * 0.46,
        width: heroPlan.width * heroPlan.scale,
      }
    : null

  for (const plan of plans) {
    const {
      fragment,
      lineIndex,
      fragmentIndex,
      emphasis,
      width,
      height,
      scale,
      collisionWidth,
      collisionHeight,
      padding,
    } = plan
    // 逐词确定性伪随机：种子来自行起始时刻 + 词/行/片段下标。
    const wordSeed =
      seed + fragment.wordIndex * 17 + lineIndex * 31 + fragmentIndex * 13
    const random = (offset: number) => {
      const x = Math.sin(wordSeed + offset) * 10000
      return x - Math.floor(x)
    }

    const passedRotate =
      (random(3) - 0.5) * (animationIntensity === 'chaotic' ? 20 : 12)
    const step = Math.max(10, Math.round(fontPx * 0.14))
    const maxRadius =
      emphasis > 1
        ? Math.max(20, lineHeight * 0.5)
        : Math.max(lineHeight * 2.2, collisionWidth * 0.75, 56)
    let preferredX = emphasis > 1 ? -width / 2 : plan.baseX
    let preferredY = emphasis > 1 ? 0 : plan.baseY

    // 先把配角从主角身边推开，再开始螺旋搜索；否则搜索会从主角内部起步。
    if (!isInterlude && emphasis <= 1 && heroMetrics) {
      let dx = preferredX + width / 2 - heroMetrics.centerX
      let dy = preferredY - height * 0.46 - heroMetrics.centerY
      const distance = Math.hypot(dx, dy)
      if (distance < 1) {
        dx = preferredX >= 0 ? 1 : -1
        dy = lineIndex % 2 === 0 ? -0.65 : 0.65
      }
      const minSeparation =
        heroMetrics.width * 0.34 + width * 0.52 + padding * 2
      if (distance < minSeparation) {
        const length = Math.max(Math.hypot(dx, dy), 1)
        const push = minSeparation - distance
        preferredX += (dx / length) * push
        preferredY += (dy / length) * push * 0.92
      }
    }

    const horizontalMin = -maxWidth / 2 - 72
    const horizontalMax = maxWidth / 2 + 72
    const verticalMin = -Math.max(totalHeight * 0.9, lineHeight * 1.6)
    const verticalMax = Math.max(totalHeight * 0.9, lineHeight * 1.45)
    let chosenX = preferredX
    let chosenY = preferredY
    let found = false
    let bestFallback = {
      x: preferredX,
      y: preferredY,
      score: Number.POSITIVE_INFINITY,
    }
    // 从「远离主角的方向」开始采样，让第一个候选就是最自然的那一侧。
    const baseAngle =
      heroMetrics && emphasis <= 1
        ? Math.atan2(preferredY, preferredX + width / 2)
        : 0

    for (let radius = 0; radius <= maxRadius && !found; radius += step) {
      const sampleCount =
        radius === 0
          ? 1
          : emphasis > 1
            ? 8
            : Math.max(
                12,
                Math.round((Math.PI * 2 * radius) / Math.max(step * 1.1, 10))
              )
      const candidates: readonly (readonly [number, number])[] =
        radius === 0
          ? [[0, 0]]
          : Array.from({ length: sampleCount }, (_unused, sampleIndex) => {
              const angle =
                baseAngle + (sampleIndex / sampleCount) * Math.PI * 2
              // 竖直方向压扁一点：行与行之间比左右更拥挤。
              const ellipseY = radius * (emphasis > 1 ? 0.8 : 0.92)
              return [
                Math.cos(angle) * radius,
                Math.sin(angle) * ellipseY,
              ] as const
            })

      for (const [dx, dy] of candidates) {
        const left = preferredX + dx - padding
        const top = preferredY + dy - collisionHeight - padding
        const right = left + collisionWidth + padding * 2
        const bottom = top + collisionHeight + padding * 2
        if (
          left < horizontalMin ||
          right > horizontalMax ||
          top < verticalMin ||
          bottom > verticalMax
        )
          continue

        const collision = evaluateRect(left, top, right, bottom)
        const score = collision.overlapArea * 2.2 + Math.hypot(dx, dy)
        if (score < bestFallback.score)
          bestFallback = { x: preferredX + dx, y: preferredY + dy, score }

        if (!collision.intersects) {
          chosenX = preferredX + dx
          chosenY = preferredY + dy
          pushPlacementRect(
            chosenX,
            chosenY,
            collisionWidth,
            collisionHeight,
            padding
          )
          found = true
          break
        }
      }
    }

    if (!found) {
      // 整个螺旋都被占满：退到重叠最少的那个候选，而不是原地堆叠。
      chosenX = bestFallback.x
      chosenY = bestFallback.y
      pushPlacementRect(
        chosenX,
        chosenY,
        collisionWidth,
        collisionHeight,
        padding
      )
    }

    // 唱完后沿「离开画面中心」的方向漂走。
    const outwardX = chosenX + width / 2
    const outwardY = chosenY - height * 0.46
    const outwardLength = Math.max(Math.hypot(outwardX, outwardY), 1)
    const driftAmount = isInterlude
      ? 3 + random(6) * 3
      : emphasis > 1
        ? 4 + random(6) * 4
        : animationIntensity === 'chaotic'
          ? 8 + random(6) * 9
          : 5 + random(6) * 6
    const graphemes = splitLyricGraphemes(fragment.text)

    placements.push({
      id: `${fragment.word.text}-${fragment.wordIndex}-${lineIndex}-${fragmentIndex}-${fragment.fragmentIndexInWord}`,
      wordIndex: fragment.wordIndex,
      word: fragment.word,
      text: fragment.text,
      color: fragment.color,
      x: chosenX,
      y: chosenY,
      width,
      height,
      scale,
      passedRotate,
      passedDriftX:
        (outwardX / outwardLength) * driftAmount + (random(7) - 0.5) * 2.4,
      passedDriftY:
        (outwardY / outwardLength) * driftAmount * 0.72 + (random(8) - 0.5) * 2,
      fragmentStartInWord: fragment.fragmentStartInWord,
      wordGraphemeCount: fragment.wordGraphemeCount,
      wordGraphemeTimings: fragment.wordGraphemeTimings,
      emphasis,
      isInterlude,
      graphemes,
      splitGlow:
        splitGlow && graphemes.length > 1 && !containsCJK(fragment.text),
      offsetX: -width / 2,
      offsetY: height * 0.42 - measureAscent(fragment.text),
    })
  }

  return placements
}

export interface CadenzaPreparedLine {
  font: string
  fontPx: number
  placements: CadenzaPlacement[]
}

export interface CadenzaPrepareContext {
  stageWidth: number
  stageHeight: number
  theme: Theme
  fontScale: number
  widthRatio: number
}

let measureContext: CanvasRenderingContext2D | null | undefined

/** 懒取一个离屏测量上下文。拿不到（如 vitest 的 node 环境）时返回 null。 */
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext === undefined) {
    try {
      measureContext = document.createElement('canvas').getContext('2d')
    } catch {
      measureContext = null
    }
  }
  return measureContext
}

/**
 * 整行的重排版。这是本模式唯一昂贵的一步 ——
 * 一行走到这里就会被完整测量、换行、切片，再转成可直接渲染的 placement。
 * 调用方必须缓存结果（见 VisualizerCadenza.vue 的 prepared 缓存）。
 */
export function prepareCadenzaLine(
  line: Line,
  context: CadenzaPrepareContext
): CadenzaPreparedLine | null {
  const { stageWidth, stageHeight, theme, fontScale, widthRatio } = context
  if (stageWidth <= 0 || stageHeight <= 0) return null

  const fontPx = clamp(
    chooseCadenzaFontPx(stageWidth, line) * fontScale,
    24,
    132
  )
  const font = buildCadenzaFont(theme, fontPx)
  let prepared: PreparedTextWithSegments
  try {
    prepared = prepareWithSegments(line.fullText, font)
  } catch {
    return null
  }

  const text = prepared.segments.join('')
  const { segmentMetas, graphemes } = buildCadenzaSegmentMetas(prepared)
  const lineHeight = Math.round(fontPx * (containsCJK(text) ? 1.22 : 1.1))
  const availableWidth = Math.max(stageWidth - 48, 120)
  const minWidth = Math.min(220, availableWidth)
  // 长句额外收紧换行宽度，让它换成更多行而不是一行拉到边。
  const wrapCompression =
    graphemes.length > 12
      ? clamp(0.92 - (graphemes.length - 12) * 0.018, 0.62, 0.92)
      : 0.92
  const maxWidth = clamp(
    Math.min(stageWidth * widthRatio * wrapCompression, 820),
    minWidth,
    availableWidth
  )
  const layout = layoutWithLines(prepared, maxWidth, lineHeight)
  const ranges = findCadenzaWordRanges(line, graphemes, theme)
  const lineViews = buildCadenzaLineFragments(
    prepared,
    segmentMetas,
    graphemes,
    layout,
    ranges
  )
  const timing = resolveCadenzaLineTiming(line)
  const context2d = getMeasureContext()
  if (context2d) context2d.font = font
  const measureAscent = (fragmentText: string) => {
    if (!context2d || !fragmentText) return fontPx * 0.78
    try {
      return (
        context2d.measureText(fragmentText).actualBoundingBoxAscent ||
        fontPx * 0.78
      )
    } catch {
      return fontPx * 0.78
    }
  }
  const placements = buildCadenzaPlacements(
    lineViews,
    fontPx,
    lineHeight,
    maxWidth,
    theme.animationIntensity,
    line.startTime * 1000,
    // 上游用 '......' 这个全文判定间奏行：它没有主角词，也不做涟漪。
    line.fullText === '......',
    timing.wordRevealMode === 'normal',
    measureAscent
  )

  return { font, fontPx, placements }
}
