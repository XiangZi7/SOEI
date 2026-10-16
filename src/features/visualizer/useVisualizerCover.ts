import { shallowRef, watch } from 'vue'
import type { ArtworkCrop } from '../../types/music'
import { assetUrl } from '../../bridge/native'
const cache = new Map<string, Promise<string | null>>()
function croppedCover(crop: ArtworkCrop): Promise<string | null> {
  const key = JSON.stringify(crop)
  const cached = cache.get(key)
  if (cached) return cached
  const result = new Promise<string | null>(resolve => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onerror = () => resolve(null)
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'),
          context = canvas.getContext('2d')
        if (!context || crop.width <= 0 || crop.height <= 0) {
          resolve(null)
          return
        }
        const scale = Math.min(1, 768 / Math.max(crop.width, crop.height))
        canvas.width = Math.max(1, Math.round(crop.width * scale))
        canvas.height = Math.max(1, Math.round(crop.height * scale))
        context.drawImage(
          image,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          canvas.width,
          canvas.height
        )
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      } catch {
        resolve(null)
      }
    }
    image.src = assetUrl(crop.source)
  })
  cache.set(key, result)
  if (cache.size > 24) cache.delete(cache.keys().next().value!)
  return result
}
/** The preview gallery uses atlas crops; shaders need the cropped image, not the entire sheet. */
export function useVisualizerCover(
  input: () => { source?: string | null; artwork?: ArtworkCrop }
) {
  const url = shallowRef<string | null>(null)
  watch(
    [() => input().source, () => input().artwork],
    ([source, artwork], _old, onCleanup) => {
      let cancelled = false
      onCleanup(() => {
        cancelled = true
      })
      if (!artwork) {
        url.value = source ? assetUrl(source) : null
        return
      }
      url.value = null
      void croppedCover(artwork).then(value => {
        if (!cancelled) url.value = value
      })
    },
    { immediate: true }
  )
  return url
}
