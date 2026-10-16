import { describe, expect, it } from 'vitest'
import {
  backgroundDefaults,
  isBackgroundMode,
  resolveBackgroundTuning,
  sanitizeBackgroundUrl,
} from './tuning'
import {
  visualizerBackgroundEntries,
  visualizerBackgroundEntry,
} from './registry'
import {
  buildGeometricScene,
  geometricShapeScale,
} from './common/geometricScene'
import {
  resolveLatentBroadbandEnergy,
  resolveLatentAudioSpeedTarget,
} from './latent/latentFrame'
import {
  getLensDistortionOverscan,
  getPaperTextureOverscan,
  resolveDaylightInversion,
  resolveHalftoneInversion,
} from './nomand/nomandShaderAdjustments'
import { getMonetBackgroundCacheKey } from './monet/monetBackgroundPipeline'
import { FALLBACK_DUAL_THEME } from '../../theme/sanitize'

describe('背景注册与持久化', () => {
  it('发现六种按序排列的懒加载背景，非法 id 回到 common', () => {
    const entries = visualizerBackgroundEntries()
    expect(entries.map(entry => entry.mode)).toEqual([
      'common',
      'monet',
      'nomand',
      'latent',
      'sora',
      'url',
    ])
    for (const entry of entries) expect(entry.component).toHaveProperty('setup')
    expect(visualizerBackgroundEntry('missing')?.mode).toBe('common')
    expect(visualizerBackgroundEntry(undefined)?.mode).toBe('common')
    expect(isBackgroundMode('__proto__')).toBe(false)
  })
  it('损坏的数据恢复默认，有限数值被钳到 UI 范围', () => {
    expect(resolveBackgroundTuning('latent', null)).toEqual(
      backgroundDefaults.latent
    )
    const value = resolveBackgroundTuning('latent', {
      meshSpeed: Infinity,
      meshDistortion: -50,
      displayMode: 'missing',
      overlayOpacity: 12,
      overlayEnabled: 'false',
      extra: true,
    })
    expect(value.meshSpeed).toBe(backgroundDefaults.latent.meshSpeed)
    expect(value.meshDistortion).toBe(0)
    expect(value.displayMode).toBe('both')
    expect(value.overlayOpacity).toBe(1)
    expect(value.overlayEnabled).toBe(true)
    expect(value).not.toHaveProperty('extra')
  })
  it('拒绝脚本、本地协议和携带凭据的网页地址', () => {
    for (const value of [
      'javascript:alert(1)',
      'file:///C:/secret',
      'data:text/html,hello',
      'https://name:password@example.com',
      '',
      null,
    ])
      expect(sanitizeBackgroundUrl(value)).toBeNull()
    expect(sanitizeBackgroundUrl(' https://example.com/path ')).toBe(
      'https://example.com/path'
    )
    expect(sanitizeBackgroundUrl('http://127.0.0.1:1420/')).toBe(
      'http://127.0.0.1:1420/'
    )
  })
})
describe('背景几何和音频边界', () => {
  it('同一分镜种子可复现，频段缩放不会被 NaN 污染', () => {
    expect(buildGeometricScene('song')).toEqual(buildGeometricScene('song'))
    expect(buildGeometricScene('other')).not.toEqual(
      buildGeometricScene('song')
    )
    expect(geometricShapeScale(NaN)).toBe(0.95)
    expect(geometricShapeScale(0)).toBe(0.95)
    expect(geometricShapeScale(1)).toBeCloseTo(1.45)
  })
  it('潜流直接读取 0..1 的五个真实频段', () => {
    expect(resolveLatentBroadbandEnergy(0, 0, 0, 0, 0)).toBe(0)
    expect(resolveLatentBroadbandEnergy(1, 1, 1, 1, 1)).toBeCloseTo(1)
    expect(resolveLatentBroadbandEnergy(0, 0, 0, 1, 0)).toBeCloseTo(
      Math.pow(0.28, 0.55)
    )
    expect(resolveLatentAudioSpeedTarget(0.5, 1, true)).toBe(1)
  })
  it('镜头与纸纹预放大有界，畸变增加时保持覆盖', () => {
    for (const bulge of [-1, 0, 0.2, 0.5, 1]) {
      const scale = getLensDistortionOverscan(bulge, 1)
      expect(scale).toBeGreaterThanOrEqual(1)
      expect(scale).toBeLessThanOrEqual(1.8)
    }
    expect(getPaperTextureOverscan(1, 1)).toBeGreaterThan(
      getPaperTextureOverscan(0, 0)
    )
    expect(resolveDaylightInversion(false, false, true)).toBe(true)
    expect(resolveDaylightInversion(false, true, true)).toBe(false)
    expect(resolveHalftoneInversion(false, false, false)).toBe(true)
  })
  it('Monet 缓存只受烘焙参数影响，漂移与构图复用位图', () => {
    const input = {
      coverUrl: 'cover.png',
      theme: FALLBACK_DUAL_THEME.dark,
      tuning: backgroundDefaults.monet,
    }
    const key = getMonetBackgroundCacheKey(input)
    expect(
      getMonetBackgroundCacheKey({
        ...input,
        tuning: {
          ...input.tuning,
          backgroundDriftStrength: 0.9,
          backgroundLayout: 'half-pane-gradient',
        },
      })
    ).toBe(key)
    expect(
      getMonetBackgroundCacheKey({
        ...input,
        tuning: { ...input.tuning, backgroundStreaksEnabled: false },
      })
    ).not.toBe(key)
  })
})
