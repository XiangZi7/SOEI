import { onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import {
  ShaderMount,
  getShaderNoiseTexture,
  type ShaderMountUniforms,
} from '@paper-design/shaders'

export interface PaperShaderConfig {
  fragment: string
  uniforms: ShaderMountUniforms
  imageUrl?: string | null
}
/** Own the GPU resources independently of the song; cancel obsolete image decodes. */
export function usePaperShader(
  host: Ref<HTMLElement | null>,
  config: () => PaperShaderConfig,
  maxPixels = 1280 * 720
) {
  let mount: ShaderMount | null = null
  let fragment = ''
  const canvas = shallowRef<HTMLCanvasElement | null>(null)
  const lost = shallowRef(false)
  let latestUniforms: ShaderMountUniforms = {}
  const sizingKeys = new Set(['u_fit', 'u_scale', 'u_rotation', 'u_originX', 'u_originY', 'u_offsetX', 'u_offsetY', 'u_worldWidth', 'u_worldHeight'])
  function uniformsFor(settings: PaperShaderConfig, uniforms: ShaderMountUniforms) {
    return Object.fromEntries(Object.entries(uniforms).filter(([key]) => sizingKeys.has(key) || settings.fragment.includes(key)))
  }
  function dispose() {
    mount?.dispose()
    mount = null
    canvas.value = null
    fragment = ''
  }
  function apply(settings: PaperShaderConfig, uniforms: ShaderMountUniforms) {
    if (!host.value || lost.value) return
    try {
      if (!mount || settings.fragment !== fragment) {
        dispose()
        mount = new ShaderMount(
          host.value,
          settings.fragment,
          uniformsFor(settings, uniforms),
          { alpha: false, antialias: false },
          0,
          0,
          1,
          maxPixels
        )
        canvas.value = mount.canvasElement
        fragment = settings.fragment
      } else mount.setUniforms(uniformsFor(settings, uniforms))
    } catch {
      dispose()
    }
  }
  watch(
    [host, config],
    ([element, settings], _old, onCleanup) => {
      let cancelled = false
      onCleanup(() => {
        cancelled = true
      })
      if (!element) {
        dispose()
        return
      }
      const uniforms = {
        ...settings.uniforms,
        ...(settings.fragment.includes('u_noiseTexture') ? { u_noiseTexture: getShaderNoiseTexture() } : {}),
      }
      latestUniforms = uniforms
      if (!settings.imageUrl) {
        apply(settings, uniforms)
        return
      }
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.decoding = 'async'
      image.onload = () => {
        if (cancelled) return
        latestUniforms = { ...uniforms, u_image: image }
        apply(settings, latestUniforms)
      }
      image.onerror = () => {
        if (!cancelled) dispose()
      }
      image.src = settings.imageUrl
    },
    { immediate: true, flush: 'post', deep: true }
  )
  useEventListener(canvas, 'webglcontextlost', event => {
    event.preventDefault()
    lost.value = true
  })
  useEventListener(canvas, 'webglcontextrestored', () => {
    lost.value = false
    dispose()
    apply(config(), latestUniforms)
  })
  onScopeDispose(dispose)
  return {
    frame(timeMs: number, uniforms?: ShaderMountUniforms) {
      if (!mount || lost.value) return
      if (uniforms) mount.setUniforms(uniforms)
      mount.setFrame(timeMs)
    },
  }
}
