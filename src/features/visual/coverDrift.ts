// AE wiggle 风格的封面漂移：把分形值噪声采样成一条很长且首尾无缝的关键帧轨道，
// 交给合成器播放，整个过程没有任何逐帧 JS。从 Folia monetBackgroundDrift.ts 移植。

// 噪声格点走完一圈的时长。足够长，所以循环不会被看出是循环。
const DRIFT_LOOP_SECONDS = 240
// 一圈的格点数。间距约 4.6s，也就是大约每 9s 一次 wiggle。
const DRIFT_LATTICE_POINTS = 76
// 一圈输出的采样数。每格三个采样，分段线性播放时不会出现可见的折角。
const DRIFT_SAMPLE_COUNT = 156

// strength 为 1 时的位移与呼吸幅度。
const DRIFT_MAX_TRAVEL_PERCENT = 3.4
const DRIFT_BREATH_AMPLITUDE = 0.035
// 在几何最小值之上再留一点余量，确保取整不会露出图片边缘。
const DRIFT_OVERSCAN_MARGIN = 0.01

// 每个通道用不同的格点序列；偏移量让 x、y 和缩放不会同步移动。
const DRIFT_SEED_X = 12.9898
const DRIFT_SEED_Y = 78.233
const DRIFT_SEED_SCALE = 39.425

export interface CoverDriftTrack {
  keyframes: Keyframe[]
  durationMs: number
  /** 任一关键帧达到的最大 |translate|，以元素自身尺寸的百分比表示。 */
  maxTravelPercent: number
  /** 任一关键帧的最小缩放；必须大于 1 + 2 * maxTravel 才能始终盖住边缘。 */
  minScale: number
}

const wrap = (value: number, modulus: number) =>
  ((value % modulus) + modulus) % modulus

function hash(lattice: number, seed: number): number {
  const value = Math.sin(lattice * 127.1 + seed * 311.7) * 43758.5453
  return value - Math.floor(value)
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** 每 points 个格点精确重复一次的值噪声，所以轨道首尾无缝。 */
function periodicNoise(t: number, points: number, seed: number): number {
  const cell = Math.floor(t)
  const from = hash(wrap(cell, points), seed)
  const to = hash(wrap(cell + 1, points), seed)
  return from + (to - from) * smoothstep(t - cell)
}

/** 两个八度的周期噪声，以 0 为中心。第二个八度提供更细的抖动。 */
function periodicFbm(t: number, seed: number): number {
  const base = periodicNoise(t, DRIFT_LATTICE_POINTS, seed)
  const detail = periodicNoise(t * 2, DRIFT_LATTICE_POINTS * 2, seed + 17.31)
  return (base * 0.68 + detail * 0.32) * 2 - 1
}

/** 把一个通道缩放到极值恰好落在 ±1，这样位移预算才是精确的。 */
function normalize(samples: number[]): number[] {
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
  return peak > 0 ? samples.map(value => value / peak) : samples
}

/**
 * 按给定强度（0..1）构建漂移动画。元素被预先放大到超过最大位移的两倍，
 * 这正是平移永远不会把图片边缘拖进画面的原因。
 */
export function buildCoverDriftTrack(strength: number): CoverDriftTrack {
  const clamped = Math.min(1, Math.max(0, strength))
  const travelPercent = DRIFT_MAX_TRAVEL_PERCENT * clamped
  const minScale = 1 + (travelPercent / 100) * 2 + DRIFT_OVERSCAN_MARGIN
  const breath = DRIFT_BREATH_AMPLITUDE * clamped

  const rawX: number[] = []
  const rawY: number[] = []
  const rawScale: number[] = []
  for (let index = 0; index <= DRIFT_SAMPLE_COUNT; index += 1) {
    const t = (DRIFT_LATTICE_POINTS * index) / DRIFT_SAMPLE_COUNT
    rawX.push(periodicFbm(t, DRIFT_SEED_X))
    rawY.push(periodicFbm(t, DRIFT_SEED_Y))
    rawScale.push(periodicFbm(t, DRIFT_SEED_SCALE))
  }

  const x = normalize(rawX)
  const y = normalize(rawY)
  const scale = normalize(rawScale)

  const keyframes = x.map((offsetX, index) => ({
    transform:
      `translate3d(${(offsetX * travelPercent).toFixed(4)}%, ${(y[index] * travelPercent).toFixed(4)}%, 0) ` +
      `scale(${(minScale + breath * ((scale[index] + 1) / 2)).toFixed(5)})`,
  }))

  return {
    keyframes,
    durationMs: DRIFT_LOOP_SECONDS * 1000,
    maxTravelPercent: travelPercent,
    minScale,
  }
}
