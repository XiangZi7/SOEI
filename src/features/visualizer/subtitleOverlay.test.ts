import { describe, expect, it } from 'vitest'
import type { Line } from '../lyrics/folia/model'
import { resolveVisualizerSubtitleOverlayContent as resolve } from './subtitleOverlay'

const line = (fullText: string, translation?: string): Line => ({
  words: [],
  startTime: 0,
  endTime: 4,
  fullText,
  translation,
})
const base = {
  showText: true,
  activeLine: line('当前句', '译文'),
  recentCompletedLine: null,
  nextLines: [line('下一句')],
}
describe('共用字幕内容', () => {
  it('显示当前行译文，避免同时挤入下一句', () => {
    const result = resolve(base)
    expect(result.subtitleTracks).toEqual([
      { role: 'translation', text: '译文' },
    ])
    expect(result.upcomingLines).toEqual([])
  })
  it('双轨按罗马音、译文顺序排列并去重', () => {
    const activeLine = { ...base.activeLine, romanization: 'Romaji' }
    expect(
      resolve({
        ...base,
        activeLine,
        subtitleContentMode: 'both',
      }).subtitleTracks.map(track => track.text)
    ).toEqual(['Romaji', '译文'])
    expect(
      resolve({
        ...base,
        activeLine: { ...activeLine, romanization: '译文' },
        subtitleContentMode: 'both',
      }).subtitleTracks
    ).toHaveLength(1)
  })
  it('间隙保留刚完成行的译文', () => {
    expect(
      resolve({
        ...base,
        activeLine: null,
        recentCompletedLine: base.activeLine,
      }).subtitleTracks[0]?.text
    ).toBe('译文')
  })
  it('无译文时预览下一句，并过滤占位分隔符', () => {
    const result = resolve({
      ...base,
      activeLine: line('当前句', '//'),
      nextLines: [line('●●●'), line('Next 2'), line('下一句')],
    })
    expect(result.subtitleTracks).toEqual([])
    expect(result.upcomingLines.map(item => item.fullText)).toEqual([
      'Next 2',
      '下一句',
    ])
  })
  it('关闭文字或隐藏字幕时整个层都隐藏', () => {
    for (const override of [
      { showText: false },
      { hideTranslationSubtitle: true },
    ]) {
      const result = resolve({ ...base, ...override })
      expect(result.shouldRenderOverlay).toBe(false)
      expect(result.subtitleTracks).toEqual([])
      expect(result.upcomingLines).toEqual([])
    }
  })
  it('legacy 关闭译文选项仍保留下一句预览', () => {
    const result = resolve({ ...base, showSubtitleTranslation: false })
    expect(result.subtitleTracks).toEqual([])
    expect(result.upcomingLines).toEqual(base.nextLines)
  })
})
