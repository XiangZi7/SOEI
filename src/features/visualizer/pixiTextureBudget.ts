// 把渲染分辨率向下吸附到 Pixi 的二次幂纹理池，让全视口的 filter pass 不再为无人绘制的像素付费。
// 从 Folia pixiTextureBudget.ts 移植。
//
// `TexturePool.getOptimalTexture` 会把每个渲染目标按轴向上取到二次幂
// （`nextPow2(ceil(frame * resolution - 1e-6))`），并以这对尺寸作为池的键。
// 也就是说一个 pass 付的是**桶**的钱，而不是画面的钱：在默认 textureResolution 1.5 下，
// 781×850 的视口光栅化成 1172×1275，落进 2048×2048 的纹理 —— 16 MiB 里只装了 5.7 MiB 画面，
// 71% 是浪费。tempera 与 sonnet 各自跑好几个这样的 pass，再加上反色 filter 的背景需要的池化拷贝，
// 浪费会成倍放大。
//
// 代价是阶梯函数，这是最容易算错的地方：在 Intel 核显上实测，窗口从 640×640 放到 700×700
// （面积 +18%），tempera 的常驻 GEM 从 628 MiB 涨到 822 MiB（+31%），因为 1.5×700 跨过了 1024，
// 每个池化目标在两个轴上同时翻倍。画面本身没有任何变化值得这个代价。
//
// 所以这里不是全局降分辨率（那会处处损失锐度，而且照样落进它该落的桶），
// 而是只让出能换到更小桶的那部分分辨率。同样的 781×850 视口上它返回 1.2047 而不是 1.5：
// 软 20%，但池化目标从 2048×2048 降到 1024×1024，内存变成四分之一，
// 而画面占纹理的比例从 29% 升到 92%。单位字节的锐度是升的，不是降的。
//
// 刻意保守：每个轴只考虑**一级**下降，且只接受落在 TEXTURE_POOL_MAX_RESOLUTION_DROP 之内的。
// 最近边界很远的视口（2000×1200 在 1.5 下需要降到 1.024，即 32%）保留它要的分辨率 ——
// 那种情况下付桶的钱是较小的恶。

/**
 * Pixi 自己的 `nextPow2`（maths/misc/pow2），这里重写而不是 import。
 *
 * 本模块必须精确预测池的桶运算，所以必须是同一个函数；但从 `pixi.js` import 它会让这个模块
 * ——以及调用它的调参函数——把整个渲染器拖进任何 bundle 和任何碰到它们的测试里，
 * 而这里其他所有 Pixi 相关的东西都藏在 loadPixi 的动态 import 后面。
 */
function nextPow2(value: number): number {
  let v = value + (value === 0 ? 1 : 0)
  v -= 1
  v |= v >>> 1
  v |= v >>> 2
  v |= v >>> 4
  v |= v >>> 8
  v |= v >>> 16
  return v + 1
}

/**
 * 一个全视口 pass 在某个轴上，Pixi 实际分配的池化纹理尺寸（设备像素）。
 * 对齐 `TexturePool.getOptimalTexture`，包括那个 epsilon —— `- 1e-6` 正是用来避免
 * 恰好落在边界上的候选值因浮点误差又被向上取整回去。
 */
export const texturePoolAxis = (cssSize: number, resolution: number) =>
  nextPow2(Math.ceil(cssSize * resolution - 1e-6))

/**
 * 一次吸附最多可以让出多少分辨率，按所申请值的比例计算。
 *
 * 下降一级总会让桶的某个轴减半，所以赢得的内存是 2 倍或 4 倍；25% 是一个分界点，
 * 越过它之后变软就会被读作「画质更低的渲染」，而不是「同样的渲染更省」。
 * 默认 1.5 可以容忍到 1.125，覆盖常见的桌面视口（781×850 需要 1.2047），且不必降到 1.0。
 */
export const TEXTURE_POOL_MAX_RESOLUTION_DROP = 0.25

/** 能让这个轴落进低一级桶的最高分辨率；已经没有更低的桶时（1 像素的桶之下没有东西）返回 null。 */
function stepDownCandidate(cssSize: number, resolution: number): number | null {
  const bucket = texturePoolAxis(cssSize, resolution)
  if (bucket < 2) return null
  return bucket / 2 / cssSize
}

/**
 * 返回实际应该渲染的分辨率：要么是 `resolution` 本身，要么是在 `maxDrop` 之内、
 * 能让池化渲染目标落进更小桶的最高值。
 *
 * 两个轴都要试，因为它们不可互换 —— 需要**更大**削减的那个轴，可能因为顺带把另一个轴也降下去
 * 而赚回两次。在 1030×520、分辨率 1.0 时，只为宽度吸附（0.994）把桶减半到 1024×1024，
 * 而为高度吸附（0.985）能到 1024×512：再省一半，只多让出 0.9% 的分辨率。
 * 所以候选值按它们产生的桶面积排序，而不是按让出得多少。
 */
export function snapResolutionToTexturePool(
  cssWidth: number,
  cssHeight: number,
  resolution: number,
  maxDrop: number = TEXTURE_POOL_MAX_RESOLUTION_DROP
): number {
  if (
    ![cssWidth, cssHeight, resolution].every(
      value => Number.isFinite(value) && value > 0
    )
  )
    return resolution
  const lowest = resolution * (1 - Math.min(Math.max(maxDrop, 0), 1))
  const candidates = [
    stepDownCandidate(cssWidth, resolution),
    stepDownCandidate(cssHeight, resolution),
  ].filter(
    (candidate): candidate is number =>
      candidate !== null &&
      candidate > 0 &&
      candidate < resolution &&
      candidate >= lowest
  )

  let best = resolution
  // 桶面积对分辨率是单调的，所以在位的那个只可能被彻底击败。
  let bestArea =
    texturePoolAxis(cssWidth, resolution) *
    texturePoolAxis(cssHeight, resolution)
  candidates.forEach(candidate => {
    const area =
      texturePoolAxis(cssWidth, candidate) *
      texturePoolAxis(cssHeight, candidate)
    if (area >= bestArea) return
    bestArea = area
    best = candidate
  })
  return best
}
