import type { LyricLine, SceneLayout } from '../../types/music'
import { buildGlyphTimings } from '../lyrics/glyphTiming'

export type LyricMotionRecipe = 'soft' | 'wipe' | 'focus' | 'lift'

export interface LyricMotionPlan {
  startMs: number
  durationMs: number
  enterMs: number
  exitMs: number
  staggerMs: number
  revealMs: number
  recipe: LyricMotionRecipe
  timings: ReturnType<typeof buildGlyphTimings>
  pulsing: boolean[]
}

const recipes: Record<SceneLayout, readonly LyricMotionRecipe[]> = {
  manuscript: ['soft', 'wipe'],
  artistic: ['soft', 'focus', 'lift'],
  collage: ['lift', 'focus', 'soft'],
  echo: ['focus', 'soft'],
  montage: ['wipe', 'lift', 'focus', 'soft'],
  readable: ['soft'],
  title: ['soft'],
}
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const easeOut = (value: number) => 1 - (1 - clamp01(value)) ** 3

/** 构图只编译一次；帧函数只读取绝对毫秒，不积累动画历史。 */
export function planLyricMotion({
  line,
  endMs,
  glyphs,
  layout,
  variant,
}: {
  line: LyricLine
  endMs: number
  glyphs: readonly string[]
  layout: SceneLayout
  variant: number
}): LyricMotionPlan {
  const durationMs = Math.max(1, endMs - line.startMs)
  const brief = durationMs < 1000
  const immediate = durationMs < 450
  const dense = line.text.length > 160
  const available = recipes[layout]
  const recipe =
    brief || dense
      ? 'soft'
      : available[Math.abs(Math.trunc(variant)) % available.length]!
  const enterMs = immediate ? 0 : Math.min(brief ? 160 : 680, durationMs * 0.28)
  const timings = buildGlyphTimings(line, endMs, glyphs)
  const lastWordEnd = timings
    ? Math.max(line.startMs, ...timings.map(timing => timing.endMs))
    : line.startMs
  // 动画预算包含错峰时间；词尚未唱完时不淡出，也不拉长真实词时间。
  const exitMs = immediate
    ? 0
    : Math.min(
        brief ? 100 : 180,
        durationMs * 0.12,
        Math.max(0, endMs - lastWordEnd)
      )
  const staggerMs =
    brief || dense
      ? 0
      : Math.min(24, (enterMs * 0.35) / Math.max(1, glyphs.length - 1))
  return {
    startMs: line.startMs,
    durationMs,
    enterMs,
    exitMs,
    staggerMs,
    revealMs: enterMs - staggerMs * Math.max(0, glyphs.length - 1),
    recipe,
    timings,
    pulsing: glyphs.map(glyph => /[\p{L}\p{N}]/u.test(glyph)),
  }
}

export function lyricGlyphFrame(
  plan: LyricMotionPlan,
  index: number,
  positionMs: number,
  direction = { x: 0, y: 20 },
  reducedMotion = false
) {
  const elapsed = positionMs - plan.startMs
  const enter = plan.enterMs
    ? easeOut((elapsed - index * plan.staggerMs) / Math.max(1, plan.revealMs))
    : 1
  const exit = plan.exitMs
    ? clamp01((elapsed - plan.durationMs + plan.exitMs) / plan.exitMs)
    : 0
  const timing = plan.timings?.[index]
  const fill = timing
    ? timing.endMs > timing.startMs
      ? clamp01((positionMs - timing.startMs) / (timing.endMs - timing.startMs))
      : Number(positionMs >= timing.startMs)
    : undefined
  const pulse =
    !reducedMotion &&
    plan.durationMs >= 1000 &&
    timing &&
    plan.pulsing[index] &&
    timing.endMs > timing.startMs &&
    fill !== undefined
      ? Math.sin(Math.PI * fill) * 0.02
      : 0
  if (reducedMotion) return { opacity: 1, x: 0, y: 0, scale: 1, clip: 0, fill }

  const travel = 1 - enter
  let x = direction.x * travel * 0.65
  let y = direction.y * travel * 0.65
  let scale = 1 + pulse
  let clip = 0
  if (plan.recipe === 'wipe') {
    x = 0
    y = 0
    clip = Math.max(travel, exit) * 100
  } else if (plan.recipe === 'focus') {
    x = 0
    y = 6 * travel
    scale -= 0.06 * travel
  } else if (plan.recipe === 'lift') y += 10 * travel - 10 * exit
  return { opacity: enter * (1 - exit), x, y, scale, clip, fill }
}

export function lyricCameraFrame(
  plan: LyricMotionPlan,
  positionMs: number,
  reducedMotion = false
) {
  if (reducedMotion || plan.durationMs < 1000) return { x: 0, y: 0, scale: 1 }
  const progress = clamp01((positionMs - plan.startMs) / plan.durationMs)
  // 两端归零的包络让停留动作与出入场连续；每次 Seek 都能直接重建。
  const envelope = Math.sin(Math.PI * progress) ** 2
  return {
    x: plan.recipe === 'lift' ? envelope * 3 : 0,
    y: plan.recipe === 'soft' ? envelope * -3 : 0,
    scale: plan.recipe === 'focus' ? 1 + envelope * 0.006 : 1,
  }
}

export function lyricInkProgress(plan: LyricMotionPlan, positionMs: number) {
  if (!plan.enterMs) return 1
  return easeOut(
    (positionMs - plan.startMs - plan.enterMs * 0.2) / (plan.enterMs * 0.8)
  )
}
