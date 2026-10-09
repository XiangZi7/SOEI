import { effectScope, nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { parseLrc } from '../lyrics/lrc'
import { useLyricTransitions } from './useLyricTransitions'

function surface() {
  const fragment = { dataset: { enterX: '20', enterY: '12' } }
  const glyphs = ['你', '好'].map(textContent => {
    const values = new Map<string, string>()
    return {
      textContent,
      dataset: {} as Record<string, string>,
      style: {
        opacity: '',
        transform: '',
        clipPath: '',
        getPropertyValue: (key: string) => values.get(key) ?? '',
        setProperty: (key: string, value: string) => values.set(key, value),
      },
      closest: () => fragment,
    }
  })
  const animations: {
    cancel: ReturnType<typeof vi.fn>
    onfinish: (() => void) | null
    oncancel: (() => void) | null
  }[] = []
  const element = {
    querySelectorAll: (selector: string) =>
      selector === '.lyric-glyph' ? glyphs : [],
    querySelector: () => null,
    animate: vi.fn(() => {
      const animation = { cancel: vi.fn(), onfinish: null, oncancel: null }
      animations.push(animation)
      return animation
    }),
  }
  return { element, glyphs, animations, dom: element as unknown as Element }
}

function setup(positionMs = 2000) {
  const options = reactive({
    animated: true,
    reducedMotion: false,
    positionMs,
    endMs: 5000,
    line: parseLrc('[00:01]<00:01>你<00:03>好<00:05>')[0]!,
    layout: 'manuscript' as const,
    variant: 0,
    trackId: 'song',
  })
  const scope = effectScope()
  const controller = scope.run(() => useLyricTransitions(() => options))!
  return { options, scope, controller }
}

describe('歌词时间轴与节点生命周期', () => {
  it('从句中进入时立即显示对应帧，同句回拖直接恢复词高亮', async () => {
    const stage = surface()
    const { options, scope, controller } = setup()
    const done = vi.fn()
    controller.enter(stage.dom, done)
    expect(done).toHaveBeenCalledOnce()
    expect(stage.glyphs[0]!.style.getPropertyValue('--lyric-fill')).toBe('50%')
    expect(stage.glyphs[1]!.style.getPropertyValue('--lyric-fill')).toBe('0%')
    options.positionMs = 4000
    await nextTick()
    expect(stage.glyphs[1]!.style.getPropertyValue('--lyric-fill')).toBe('50%')
    options.positionMs = 2000
    await nextTick()
    expect(stage.glyphs[0]!.style.getPropertyValue('--lyric-fill')).toBe('50%')
    expect(stage.glyphs[1]!.style.getPropertyValue('--lyric-fill')).toBe('0%')
    scope.stop()
  })

  it('大幅跳转直接移除旧画面，不叠加滞后的跨句动画', () => {
    const stage = surface()
    const { options, scope, controller } = setup()
    controller.enter(stage.dom, vi.fn())
    options.positionMs = 12000
    const done = vi.fn()
    controller.leave(stage.dom, done)
    expect(done).toHaveBeenCalledOnce()
    expect(stage.element.animate).not.toHaveBeenCalled()
    scope.stop()
  })

  it('连续切句只保留一个离场节点，暂停立即清理该节点', async () => {
    const first = surface()
    const second = surface()
    const { options, scope, controller } = setup()
    controller.enter(first.dom, vi.fn())
    const firstDone = vi.fn()
    controller.leave(first.dom, firstDone)
    controller.enter(second.dom, vi.fn())
    const secondDone = vi.fn()
    controller.leave(second.dom, secondDone)
    expect(firstDone).toHaveBeenCalledOnce()
    expect(first.animations[0]!.cancel).toHaveBeenCalledOnce()
    expect(secondDone).not.toHaveBeenCalled()
    options.animated = false
    await nextTick()
    expect(secondDone).toHaveBeenCalledOnce()
    expect(second.animations[0]!.cancel).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('卸载时完成未结束的离场回调，Vue 可以移除旧节点', () => {
    const stage = surface()
    const { scope, controller } = setup()
    controller.enter(stage.dom, vi.fn())
    const done = vi.fn()
    controller.leave(stage.dom, done)
    scope.stop()
    expect(done).toHaveBeenCalledOnce()
    expect(stage.animations[0]!.cancel).toHaveBeenCalledOnce()
    expect(stage.animations[0]!.onfinish).toBeNull()
  })

  it('减少动态效果和卸载清理不会让旧动画重新写入节点', async () => {
    const stage = surface()
    const { options, scope, controller } = setup(1200)
    controller.enter(stage.dom, vi.fn())
    options.reducedMotion = true
    await nextTick()
    expect(stage.glyphs[0]!.style.opacity).toBe('1')
    expect(stage.glyphs[0]!.style.transform).toBe(
      'translate3d(0px, 0px, 0) scale(1)'
    )
    const fill = stage.glyphs[0]!.style.getPropertyValue('--lyric-fill')
    scope.stop()
    options.positionMs = 4000
    await nextTick()
    expect(stage.glyphs[0]!.style.getPropertyValue('--lyric-fill')).toBe(fill)
  })
})
