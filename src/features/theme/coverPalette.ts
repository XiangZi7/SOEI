import { extractRepresentativeColorsFromPixels } from './medianCut'
import type { ArtworkCrop } from '../../types/music'
import { assetUrl } from '../../bridge/native'

// 封面取色的浏览器侧入口：把封面缩到 50×50 后读像素，再交给加权中位切分。
const SAMPLE_SIZE = 50

/**
 * 读取封面像素。与上游不同之处：`getImageData` 包在 try/catch 里。
 * Tauri 的资源协议（convertFileSrc 产出 http://asset.localhost/...）在缺少 CORS 响应头时
 * 会污染画布并让 getImageData 抛 SecurityError；取色失败应当安静降级到兜底主题，
 * 而不是让整条主题链路崩掉。
 */
function loadCoverPixels(
  source: string,
  crop?: ArtworkCrop
): Promise<Uint8ClampedArray | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = SAMPLE_SIZE
      canvas.height = SAMPLE_SIZE
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        resolve(null)
        return
      }
      try {
        // 有裁剪信息时只取用户实际看到的那块区域。
        if (crop)
          context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            SAMPLE_SIZE,
            SAMPLE_SIZE
          )
        else context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        resolve(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data)
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = source
  })
}

/** 按像素占比返回封面的代表色，最多 count 个；无法读取时返回空数组。 */
export async function extractCoverColors(
  cover: { coverRef?: string | null; artwork?: ArtworkCrop },
  count = 5
): Promise<string[]> {
  const source = cover.artwork?.source ?? cover.coverRef
  if (!source) return []
  const pixels = await loadCoverPixels(assetUrl(source), cover.artwork)
  return pixels ? extractRepresentativeColorsFromPixels(pixels, count) : []
}
