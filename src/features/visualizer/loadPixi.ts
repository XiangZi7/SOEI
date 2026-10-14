import { installPixiFilterPoolCompat } from './pixiFilterPoolCompat'

// visualizer 引入 Pixi 的唯一入口，这样在第一个 program 编译之前就把着色器默认精度提上去。
// 从 Folia loadPixi.ts 移植。
//
// Pixi 会给每个没有自己声明精度的片元着色器注入 `precision mediump float;`
// （`GlProgram.defaultOptions.preferredFragmentPrecision`）。在 Windows 和 Intel/Mesa 上这不花钱 ——
// 它们的驱动把 mediump 报成 127/127/23，也就是它本来**就是** fp32。
// 真正按字面执行这个限定符的是 NVIDIA 的 Linux 驱动：Chromium 经 ANGLE 走原生
// `OpenGL ES 3.2` 上下文，那里 mediump 是真正的 fp16（getShaderPrecisionFormat 报 15/15/10，
// 最大有限值 65504）。
//
// 这个差别不是观感问题。Pixi 自带的 NoiseFilter —— tempera 与 sonnet 后处理链里的颗粒 pass ——
// 计算 `fract(sin(dot(gl_FragCoord.xy * uSeed, vec2(12.9898, 78.233))) * 43758.5453)`。
// 点积随像素坐标线性增长，所以越过大约 `65504 / uSeed` 之后就溢出 fp16 成 Inf，
// `sin(Inf)` 是 NaN，那条线之外的每个像素都被写成黑色。因为溢出条件对 x 和 y 都是线性的，
// 边界是一条横跨画面的直线：这正是 Linux + NVIDIA 上报告的黑色三角，
// 它随 textureResolution 增大（因为 gl_FragCoord 随之增大），且每个场景不同（uSeed 由场景种子派生）。
// 只封顶后处理分辨率只会挪动种子阈值 —— 在 pass 分辨率 1.0 下，0.95 的种子在 1280×720 的帧上仍会溢出。
//
// highp 在任何能跑这个应用的设备上都是 fp32：GLSL ES 3.00 要求片元支持 highp，
// 而 Pixi 8 只支持 WebGL2/WebGPU。若某设备确实报告不支持 highp，`ensurePrecision` 仍会降回 mediump，
// 那正是今天的行为，所以不会变得更糟。自己声明了精度行的着色器不受影响。
type PixiModule = typeof import('pixi.js')

/**
 * 必须在构造任何 renderer、filter 或 shader 之前 await：`GlProgram.from` 会缓存编译后的源码，
 * 在切换之前建好的 program 会一直保留它的 mediump 变体。
 */
export async function loadPixi(): Promise<PixiModule> {
  const pixi = await import('pixi.js')
  pixi.GlProgram.defaultOptions.preferredFragmentPrecision = 'highp'
  installPixiFilterPoolCompat(pixi)
  return pixi
}
