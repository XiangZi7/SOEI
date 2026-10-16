import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { usePaperShader, type PaperShaderConfig } from './usePaperShader'
const fake = vi.hoisted(() => ({
  mounts: [] as {
    setUniforms: ReturnType<typeof vi.fn>
    setFrame: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
    canvasElement: HTMLCanvasElement
    args: unknown[]
  }[],
}))
vi.mock('@vueuse/core', () => ({ useEventListener: vi.fn() }))
vi.mock('@paper-design/shaders', () => ({
  getShaderNoiseTexture: () => undefined,
  ShaderMount: class {
    setUniforms = vi.fn()
    setFrame = vi.fn()
    dispose = vi.fn()
    canvasElement = {} as HTMLCanvasElement
    args: unknown[]
    constructor(...args: unknown[]) {
      this.args = args
      fake.mounts.push(this)
    }
  },
}))
beforeEach(() => {
  fake.mounts.length = 0
})
describe('Paper shader 资源生命周期', () => {
  it('调色更新复用实例，换效果释放旧实例，卸载不遗留绘制', async () => {
    const scope = effectScope(),
      host = shallowRef({} as HTMLElement)
    const config = shallowRef<PaperShaderConfig>({
      fragment: 'uniform float u_value;',
      uniforms: { u_value: 1 },
    })
    const shader = scope.run(() => usePaperShader(host, () => config.value))!
    expect(fake.mounts).toHaveLength(1)
    expect(fake.mounts[0].args[4]).toBe(0) // the application, not a second RAF, owns time
    config.value = { ...config.value, uniforms: { u_value: 2 } }
    await nextTick()
    expect(fake.mounts).toHaveLength(1)
    expect(fake.mounts[0].setUniforms).toHaveBeenCalledWith({ u_value: 2 })
    config.value = { ...config.value, fragment: 'uniform float u_other;' }
    await nextTick()
    expect(fake.mounts).toHaveLength(2)
    expect(fake.mounts[0].dispose).toHaveBeenCalledOnce()
    scope.stop()
    expect(fake.mounts[1].dispose).toHaveBeenCalledOnce()
    shader.frame(500)
    expect(fake.mounts[1].setFrame).not.toHaveBeenCalled()
  })
  it('快速换封面忽略旧解码；卸载后的新解码不会重建 WebGL', async () => {
    const images: { onload: () => void; src: string }[] = []
    class FakeImage {
      onload = () => {}
      onerror = () => {}
      src = ''
      constructor() {
        images.push(this)
      }
    }
    vi.stubGlobal('Image', FakeImage)
    const scope = effectScope(),
      host = shallowRef({} as HTMLElement)
    const config = shallowRef<PaperShaderConfig>({
      fragment: 'uniform sampler2D u_image;',
      uniforms: {},
      imageUrl: 'old.png',
    })
    scope.run(() => usePaperShader(host, () => config.value))
    config.value = { ...config.value, imageUrl: 'new.png' }
    await nextTick()
    images[0].onload()
    expect(fake.mounts).toHaveLength(0)
    images[1].onload()
    expect(fake.mounts).toHaveLength(1)
    expect(fake.mounts[0].args[2]).toEqual({ u_image: images[1] })
    config.value = { ...config.value, imageUrl: 'last.png' }
    await nextTick()
    scope.stop()
    images[2].onload()
    expect(fake.mounts).toHaveLength(1)
    expect(fake.mounts[0].dispose).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
