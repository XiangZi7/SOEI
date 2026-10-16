// Adapted from Folia backgrounds/common/FluidBackground.tsx (AGPL-3.0);
// see third_party/Folia-NOTICE.md.

/**
 * 降采样后的模糊源的最长边（px）。
 *
 * 背景是封面的 blur(40px)，而 40px 的模糊已经抹掉了一切比 40px 更细的细节 ——
 * 所以 384px 的源与全分辨率源模糊出来的结果在视觉上没有区别。区别在 GPU 开销：
 * 全分辨率封面（常见 1000–3000px）首次合成时按**瓦片**上传纹理，每块瓦片落地时
 * 各自出现一次，那就是换歌时看到的网格状闪烁 —— 也解释了为什么大封面会闪、
 * 小封面从来不闪。384px 的源一块瓦片就传完，任何尺寸的封面都不再闪烁。
 * 为构建它而在离屏解码的全分辨率图像从不上屏。
 */
export const COVER_BLUR_SOURCE_MAX = 384

/**
 * 把封面降采样成单瓦片大小的 data URL。
 *
 * 失败时返回 null，调用方退回原始 URL —— 跨域且没有 CORS 头的封面会污染 canvas，
 * `toDataURL` 随即抛错，这时宁可要一张会闪一下的背景，也不要没有背景。
 */
export function buildDownscaledCover(
  coverUrl: string,
  maxSize = COVER_BLUR_SOURCE_MAX
): Promise<string | null> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      try {
        const naturalWidth = image.naturalWidth || image.width
        const naturalHeight = image.naturalHeight || image.height
        if (!naturalWidth || !naturalHeight) {
          resolve(null)
          return
        }
        const scale = Math.min(
          1,
          maxSize / Math.max(naturalWidth, naturalHeight)
        )
        const width = Math.max(1, Math.round(naturalWidth * scale))
        const height = Math.max(1, Math.round(naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          resolve(null)
          return
        }
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = coverUrl
  })
}
