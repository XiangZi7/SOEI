import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import type { ArtworkCrop } from '../../../types/music'
import type { Line } from '../../lyrics/folia/model'
import { buildMonetDisplayTokens } from '../../lyrics/folia/monetLyricsModel'
import { hasMeasuredMonetTiming, monetSweepFrame } from './monetFrame'
import {
  pushMonetPortraitLayer,
  settleMonetPortraitLayers,
} from './monetPortraitCrossfade'
import { sampleSpectrumProfile, sampleRawSpectrumProfile } from './monetAudio'
import { useVisualizerCover } from '../useVisualizerCover'
import { resolveMonetTuning } from './tuning'
const line: Line = {
  fullText: 'Hello, world!',
  startTime: 1,
  endTime: 5,
  words: [
    { text: 'Hello', startTime: 1, endTime: 2 },
    { text: 'world', startTime: 3, endTime: 4 },
  ],
}
describe('Monet 真实词时间与绝对时间扫光', () => {
  it('保留标点和空格；普通 LRC 与估算词不冒充演唱时间', () => {
    const tokens = buildMonetDisplayTokens(line)
    expect(tokens.map(token => token.text).join('')).toBe(line.fullText)
    expect(
      tokens
        .filter(token => hasMeasuredMonetTiming(line, token))
        .map(token => token.text)
    ).toEqual(['Hello', 'world'])
    const plain = { ...line, words: [] }
    expect(
      hasMeasuredMonetTiming(plain, buildMonetDisplayTokens(plain)[0])
    ).toBe(false)
    const estimated = {
      ...line,
      words: line.words.map(word => ({ ...word, estimated: true })),
    }
    expect(hasMeasuredMonetTiming(estimated, tokens[0])).toBe(false)
  })
  it('同句回拖精确复现 mask 与光晕，减少动态效果保留真实扫光', () => {
    const token = buildMonetDisplayTokens(line)[0],
      offsets = [0, 10, 20, 30, 40, 50]
    const frame = (time: number, reduced = false) =>
      monetSweepFrame(time, token, offsets, 40, 5, '#ffffff', false, reduced)
    const first = frame(1.5)
    expect(first.mask).not.toBe(frame(1.8).mask)
    expect(frame(1.5)).toEqual(first)
    expect(frame(2).passed).toBe(true)
    expect(frame(1).glow).toBe('none')
    expect(frame(1.5, true).glow).toBe('none')
    expect(frame(1.5, true).mask).toBe(first.mask)
  })
  it('快速换歌保留已解码封面，过期完成事件不移除新封面', () => {
    let layers = pushMonetPortraitLayer([], 'a.png', 'a')
    layers = pushMonetPortraitLayer(layers, 'b.png', 'b')
    layers = pushMonetPortraitLayer(layers, 'c.png', 'c')
    expect(
      settleMonetPortraitLayers(layers, 'b').map(layer => layer.src)
    ).toEqual(['b.png', 'c.png'])
    expect(
      settleMonetPortraitLayers(layers, 'c').map(layer => layer.src)
    ).toEqual(['c.png'])
    expect(pushMonetPortraitLayer(layers, 'c.png', 'repeat')).toBe(layers)
  })
  it('频段响应在无信号时为零，不编造预览频谱', () => {
    for (let i = 0; i <= 1; i += 0.1)
      expect(sampleSpectrumProfile([0, 0, 0, 0, 0], i)).toBe(0)
    expect(sampleRawSpectrumProfile(new Uint8Array(64), 0.5)).toBe(0)
    expect(sampleSpectrumProfile([1, 1, 1, 1, 1], 0.5)).toBeGreaterThan(0.8)
    expect(resolveMonetTuning({ fontScale: Infinity }).fontScale).toBe(1.2)
  })
  it('图集加载被换歌或卸载中断时，不覆盖后来选择的封面', async () => {
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
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({ drawImage: () => {} }),
        toDataURL: () => 'data:cropped',
      }),
    })
    const state = shallowRef<{ source?: string | null; artwork?: ArtworkCrop }>(
      {
        source: 'sheet.png',
        artwork: {
          source: 'sheet.png',
          x: 0,
          y: 0,
          width: 30,
          height: 30,
          sourceWidth: 90,
          sourceHeight: 90,
        },
      }
    )
    const scope = effectScope()
    const cover = scope.run(() => useVisualizerCover(() => state.value))!
    state.value = { source: 'current.png' }
    await nextTick()
    images[0].onload()
    await Promise.resolve()
    await nextTick()
    expect(cover.value).toBe('current.png')
    scope.stop()
    vi.unstubAllGlobals()
  })
})
