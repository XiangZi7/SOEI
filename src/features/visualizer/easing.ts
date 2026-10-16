// CSS cubic-bezier 的 JS 求值。多个移植模式的入场缓动都写成精确的 cubic-bezier
// （tilt 用 0.25/0.46/0.45/0.94，tempera 用 0.22/1/0.36/1），而绝对时间求帧需要在 JS 里
// 取到同一条曲线上的值，所以这里实现一次。
//
// 思路与上游 tempera/temperaMotionEasing.ts 一致：x(t) 在 [0,1] 上单调，
// 用二分法反解出参数 t，再代入 y(t)。12 次二分的精度（~2e-4）远小于一帧的视觉差异。
const BISECTION_STEPS = 12

const bezier = (a: number, b: number, t: number) => {
  const inverse = 1 - t
  // 三次贝塞尔的首末控制点固定在 0 与 1，所以只剩两个自由参数。
  return 3 * a * inverse * inverse * t + 3 * b * inverse * t * t + t * t * t
}

/** 返回 `cubic-bezier(x1, y1, x2, y2)` 在进度 `progress` 处的值。 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number
): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  // 线性曲线直接返回，省掉二分。
  if (x1 === y1 && x2 === y2) return progress
  let low = 0
  let high = 1
  let t = progress
  for (let step = 0; step < BISECTION_STEPS; step += 1) {
    const x = bezier(x1, x2, t)
    if (x < progress) low = t
    else high = t
    t = (low + high) / 2
  }
  return bezier(y1, y2, t)
}

/** 预绑定一条曲线，避免在帧循环里反复传四个控制点。 */
export const easing =
  (x1: number, y1: number, x2: number, y2: number) => (progress: number) =>
    cubicBezier(x1, y1, x2, y2, progress)

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
export const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount

/**
 * framer-motion `spring({ stiffness, damping, mass })` 的**解析阶跃响应**。
 *
 * 移植的模式把 spring 当入场曲线用，而 SOEI 走绝对时间求帧：不能积分历史帧，
 * 必须能对任意时刻直接求值（Seek 要立刻落到正确画面）。所以这里解析地给出
 * 单位阶跃响应，而不是模拟弹簧。
 *
 * ωn = √(k/m)，ζ = c / (2√(k·m))。三种阻尼情形的闭式解都不同：
 *   ζ < 1（欠阻尼）：1 - e^(-ζωn·t)·(cos(ωd·t) + ζωn/ωd·sin(ωd·t))，ωd = ωn√(1-ζ²)
 *   ζ = 1（临界）：  1 - (1 + ωn·t)·e^(-ωn·t)
 *   ζ > 1（过阻尼）：两个实指数的组合
 *
 * 返回的函数在 t<=0 时为 0，并在 `settleSec` 之后钳到 1 —— 指数尾巴理论上无限长，
 * 钳位让「已经到位」有一个明确边界。
 */
export function springStep(
  stiffness: number,
  damping: number,
  mass = 1,
  settleSec = Number.POSITIVE_INFINITY
): (elapsedSec: number) => number {
  const omega = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  if (zeta < 1) {
    const damped = omega * Math.sqrt(1 - zeta * zeta)
    const decay = zeta * omega
    return elapsed => {
      if (elapsed <= 0) return 0
      if (elapsed >= settleSec) return 1
      return (
        1 -
        Math.exp(-decay * elapsed) *
          (Math.cos(damped * elapsed) +
            (decay / damped) * Math.sin(damped * elapsed))
      )
    }
  }
  if (zeta === 1)
    return elapsed => {
      if (elapsed <= 0) return 0
      if (elapsed >= settleSec) return 1
      return 1 - (1 + omega * elapsed) * Math.exp(-omega * elapsed)
    }
  const root = omega * Math.sqrt(zeta * zeta - 1)
  const fast = -zeta * omega + root
  const slow = -zeta * omega - root
  return elapsed => {
    if (elapsed <= 0) return 0
    if (elapsed >= settleSec) return 1
    return (
      1 -
      (slow * Math.exp(fast * elapsed) - fast * Math.exp(slow * elapsed)) /
        (slow - fast)
    )
  }
}

/** 弹簧跟随器：持续追一个会变的目标值。 */
export interface SpringFollower {
  /** 推进一帧并返回新的当前值。 */
  step(target: number, deltaSec: number): number
  /** 直接落位（换歌、Seek、首帧）。 */
  snap(value: number): void
  /** 不推进时间地读当前值。 */
  get(): number
}

/** 单个子步的最大时长。超过它弹簧积分会发散，所以按这个长度切分。 */
const SPRING_MAX_SUBSTEP_SECONDS = 1 / 120

/**
 * framer-motion `useSpring(liveValue, { stiffness, damping, mass })` 的等价物。
 *
 * 与 `springStep` 的区别：`springStep` 是对**固定目标**的解析阶跃响应，用于入场动画，
 * 任意时刻可直接求值，所以 Seek 不需要重演。这里追的是**持续变化的目标**（音频能量），
 * 本来就不存在「从时钟复现」这回事 —— 音频响应不可回放 —— 所以用真正的积分。
 *
 * 用半隐式欧拉并把每帧切成 ≤1/120 秒的子步：掉帧时一大步积分会让弹簧发散，
 * 切分后同样的 deltaSec 得到同样的结果，与帧率无关。
 */
export function createSpringFollower(
  stiffness: number,
  damping: number,
  mass = 1,
  initial = 0
): SpringFollower {
  let position = initial
  let velocity = 0
  return {
    step(target, deltaSec) {
      if (!Number.isFinite(target)) return position
      const total = Math.max(0, Math.min(deltaSec, 0.25))
      const steps = Math.max(1, Math.ceil(total / SPRING_MAX_SUBSTEP_SECONDS))
      const dt = total / steps
      for (let index = 0; index < steps; index += 1) {
        const acceleration =
          (-stiffness * (position - target) - damping * velocity) / mass
        velocity += acceleration * dt
        position += velocity * dt
      }
      return position
    },
    snap(value) {
      position = value
      velocity = 0
    },
    get: () => position,
  }
}
