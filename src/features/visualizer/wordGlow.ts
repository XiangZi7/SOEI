import { colorWithAlpha } from '../theme/colorMath'

// classic 与 partita 共用的逐字光晕。从 Folia wordGlow.ts 移植。
//
// 上游在这里记了一条只有踩过才知道的经验：这个光晕原本用 `text-shadow` 从 `none` 插值，
// 而那正是**不能**在 Linux 上发布的动画 —— Chromium 的 GPU 光栅化器按 strike 缓存字形，
// strike 的键里含阴影在设备空间的 blur sigma（CSS 半径 × 该图层的光栅缩放），
// 每个新 strike 会从永不归还的 4 KiB 共享内存块里取走一个可丢弃句柄。
// 每帧都在变的半径会无休止地铸造 strike；渲染进程与 GPU 进程每约一千个就多一个 fd 和一次内存映射，
// Linux 上渲染进程 1024 的软上限约 35 分钟播放后耗尽，合成器随即停止出帧。
//
// 对半径取整没用：各个词的光栅缩放都不同，所以有界的 CSS 半径集合仍然是无界的设备 sigma 集合
// （上游实测只减少 70%，不是 100%）。
//
// 所以改用 `filter: drop-shadow()`：filter 由合成器整层施加，永不经过字形缓存，半径可以自由动画。
// 代价是光晕层必须带着**有颜色**的字形（drop-shadow 投影的是被绘制的内容），
// 它恰好压在正文之下，所以这份副本本身看不见。
//
// **与上游的唯一差别**：上游保留了 text-shadow 旧路径并用开关切换（Linux 默认走 drop-shadow），
// 以兼容它更早的观感。SOEI 没有这段历史，而 text-shadow 正是会泄漏 fd 的那条路径，
// 所以这里只实现 drop-shadow 一条路。

/** 每单位 text-shadow 半径对应的 drop-shadow 半径，上游按像素差拟合得出。 */
const DROP_SHADOW_RADIUS_SCALE = 0.4
/** 内层 drop-shadow 的透明度：链式叠加时外层也会给它投影，所以必须更弱。 */
const DROP_SHADOW_INNER_ALPHA = 0.7

/**
 * 词的揭示方式。上游用 `wordRevealMode`（见 lyrics/folia/renderHints.ts）决定，
 * 另外区分「多字逐字扫过」与「单字/CJK 持续发光」两种。
 */
export type WordGlowMode = 'instant' | 'fast' | 'sweep' | 'sustained'

export interface WordGlowTiming {
  /** 等效的 text-shadow 内/外半径（px）。实际 filter 半径会乘上 RADIUS_SCALE。 */
  inner: number
  outer: number
  durationSec: number
  delaySec: number
  /** 归一化时间轴上的三个控制点，与 peaks 一一对应。 */
  times: readonly [number, number, number]
  /** 三个控制点上的光晕强度 0..1。 */
  peaks: readonly [number, number, number]
}

export interface WordGlowInput {
  mode: WordGlowMode
  /** 词的时长（秒）。 */
  durationSec?: number
  /** sweep 模式下该词内的字素总数。 */
  total?: number
  /** sweep 模式下当前字素的序号。 */
  index?: number
  /** 有真实字素时间时传入，三者必须同时有值才生效。 */
  charStartSec?: number
  charEndSec?: number
  wordStartSec?: number
}

/** 解析一个字素的光晕时序。数值与上游 wordGlowVariants 逐项一致。 */
export function wordGlowTiming(input: WordGlowInput): WordGlowTiming {
  const {
    mode,
    durationSec,
    total,
    index,
    charStartSec,
    charEndSec,
    wordStartSec,
  } = input
  if (mode === 'instant')
    return {
      inner: 14,
      outer: 24,
      durationSec: Math.min(durationSec || 0.08, 0.12),
      delaySec: 0,
      times: [0, 0.35, 1],
      peaks: [0, 1, 0],
    }
  if (mode === 'fast')
    return {
      inner: 18,
      outer: 32,
      durationSec: Math.min(Math.max(durationSec || 0.12, 0.12), 0.2),
      delaySec: 0,
      times: [0, 0.4, 1],
      peaks: [0, 1, 0],
    }
  if (mode === 'sweep' && total !== undefined && total > 1) {
    const singleDuration = (durationSec ?? 0) / total
    const hasCharTiming =
      typeof charStartSec === 'number' &&
      typeof charEndSec === 'number' &&
      typeof wordStartSec === 'number'
    const charDuration = hasCharTiming
      ? Math.max(charEndSec - charStartSec, 0.001)
      : singleDuration
    const charDelay = hasCharTiming
      ? Math.max(0, charStartSec - wordStartSec)
      : singleDuration * (index ?? 0)
    return {
      inner: 20,
      outer: 40,
      // 把淡出拉长到几个字的跨度上。
      durationSec: charDuration * 6,
      delaySec: charDelay,
      // 早峰值，然后淡出。
      times: [0, 0.3, 1],
      peaks: [0, 1, 0],
    }
  }
  // 单字 / CJK：持续发光。
  return {
    inner: 20,
    outer: 40,
    durationSec: durationSec || 0.1,
    delaySec: 0,
    times: [0, 0.9, 1],
    peaks: [0, 1, 1],
  }
}

/**
 * 求某一时刻的光晕强度 0..1。`elapsedSec` 从词激活的那一刻起算。
 * 控制点之间线性插值 —— 上游在 framer 里用的是 easeInOut/easeOut，
 * 但曲线形状由各模式自己在 CSS 过渡里补，这里只给包络的值。
 */
export function wordGlowEnvelope(
  timing: WordGlowTiming,
  elapsedSec: number
): number {
  const local = elapsedSec - timing.delaySec
  if (local <= 0) return timing.peaks[0]
  if (timing.durationSec <= 0) return timing.peaks[2]
  const progress = local / timing.durationSec
  if (progress >= 1) return timing.peaks[2]
  const { times, peaks } = timing
  for (let index = 1; index < times.length; index += 1) {
    const from = times[index - 1]!
    const to = times[index]!
    if (progress <= to) {
      const span = to - from
      const ratio = span <= 0 ? 1 : (progress - from) / span
      return peaks[index - 1]! + (peaks[index]! - peaks[index - 1]!) * ratio
    }
  }
  return peaks[peaks.length - 1]!
}

/**
 * 按 text-shadow 的等效半径生成合成器 filter。
 * `peak` 为 0 时返回 'none'，避免留下一个恒存的合成层。
 */
export function wordGlowFilter(
  color: string,
  timing: WordGlowTiming,
  peak: number
): string {
  if (peak <= 0) return 'none'
  const inner = timing.inner * peak * DROP_SHADOW_RADIUS_SCALE
  const outer = timing.outer * peak * DROP_SHADOW_RADIUS_SCALE
  return (
    `drop-shadow(0 0 ${inner.toFixed(2)}px ${colorWithAlpha(color, DROP_SHADOW_INNER_ALPHA)}) ` +
    `drop-shadow(0 0 ${outer.toFixed(2)}px ${color})`
  )
}
