import {
  DEFAULT_LATENT_BACKGROUND_TUNING,
  DEFAULT_MONET_BACKGROUND_TUNING,
  DEFAULT_NOMAND_BACKGROUND_TUNING,
  DEFAULT_SORA_BACKGROUND_TUNING,
} from './model'

export const backgroundDefaults = {
  common: {
    useCoverColorBg: false,
    opacity: 0.75,
    disableGeometricBackground: false,
    disableVignette: false,
  },
  monet: DEFAULT_MONET_BACKGROUND_TUNING,
  latent: DEFAULT_LATENT_BACKGROUND_TUNING,
  nomand: DEFAULT_NOMAND_BACKGROUND_TUNING,
  sora: DEFAULT_SORA_BACKGROUND_TUNING,
  url: { url: '' },
}
export type BackgroundMode = keyof typeof backgroundDefaults
export interface BackgroundControl {
  key: string
  label: string
  min?: number
  max?: number
  step?: number
  options?: readonly string[]
  when?: { key: string; value: string }
}
export const backgroundControls: Record<BackgroundMode, BackgroundControl[]> = {
  common: [
    { key: 'useCoverColorBg', label: '封面流体色彩' },
    { key: 'opacity', label: '主题遮罩', min: 0, max: 1, step: 0.05 },
    { key: 'disableGeometricBackground', label: '隐藏几何形状' },
    { key: 'disableVignette', label: '关闭暗角' },
  ],
  sora: [{ key: 'blank', label: '纯色背景' }],
  url: [{ key: 'url', label: '网页地址' }],
  monet: [
    {
      key: 'backgroundLayout',
      label: '背景构图',
      options: ['full-overlay', 'half-pane-gradient'],
    },
    { key: 'backgroundBlurPx', label: '模糊', min: 0, max: 60, step: 1 },
    {
      key: 'backgroundOverlayOpacity',
      label: '遮罩强度',
      min: 0,
      max: 1,
      step: 0.02,
    },
    { key: 'backgroundGrayscale', label: '灰度', min: 0, max: 1, step: 0.05 },
    {
      key: 'backgroundSaturation',
      label: '饱和度',
      min: 0,
      max: 2,
      step: 0.05,
    },
    { key: 'backgroundWash', label: '主题染色', min: 0, max: 1, step: 0.05 },
    { key: 'backgroundDriftEnabled', label: '封面漂移' },
    {
      key: 'backgroundDriftStrength',
      label: '漂移幅度',
      min: 0,
      max: 1,
      step: 0.05,
    },
    { key: 'backgroundStreaksEnabled', label: '竖向纹理' },
  ],
  latent: [
    {
      key: 'displayMode',
      label: '层次',
      options: ['both', 'mesh', 'dithering'],
    },
    {
      key: 'colorSource',
      label: '颜色来源',
      options: ['cover-theme', 'cover-only'],
    },
    { key: 'enhancedBeatResponse', label: '增强节拍响应' },
    { key: 'ditheringSpeed', label: '像素流速', min: 0, max: 2, step: 0.05 },
    {
      key: 'ditheringAudioSpeed',
      label: '像素节拍流速',
      min: 0,
      max: 2,
      step: 0.05,
    },
    { key: 'ditheringSize', label: '像素大小', min: 0.5, max: 10, step: 0.5 },
    {
      key: 'ditheringOpacity',
      label: '像素透明度',
      min: 0,
      max: 1,
      step: 0.05,
    },
    { key: 'meshSpeed', label: '渐变流速', min: 0, max: 2, step: 0.05 },
    {
      key: 'meshAudioSpeed',
      label: '渐变节拍流速',
      min: 0,
      max: 2,
      step: 0.05,
    },
    { key: 'meshDistortion', label: '渐变扭曲', min: 0, max: 1, step: 0.05 },
    { key: 'meshSwirl', label: '旋涡', min: 0, max: 1, step: 0.05 },
    { key: 'overlayEnabled', label: '主题遮罩' },
    { key: 'overlayOpacity', label: '遮罩强度', min: 0, max: 1, step: 0.05 },
  ],
  nomand: [
    {
      key: 'effect',
      label: '封面效果',
      options: [
        'dithering',
        'fluted-glass',
        'paper-texture',
        'halftone-dots',
        'lens-distortion',
      ],
    },
    {
      key: 'size',
      label: '像素大小',
      min: 0.5,
      max: 20,
      step: 0.5,
      when: { key: 'effect', value: 'dithering' },
    },
    {
      key: 'colorSteps',
      label: '色阶',
      min: 1,
      max: 7,
      step: 1,
      when: { key: 'effect', value: 'dithering' },
    },
    {
      key: 'originalColors',
      label: '原始色彩',
      when: { key: 'effect', value: 'dithering' },
    },
    {
      key: 'inverted',
      label: '反色',
      when: { key: 'effect', value: 'dithering' },
    },
    {
      key: 'flutedGlassSize',
      label: '玻璃条纹',
      min: 0.01,
      max: 1,
      step: 0.01,
      when: { key: 'effect', value: 'fluted-glass' },
    },
    {
      key: 'flutedGlassDistortion',
      label: '玻璃折射',
      min: 0,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'fluted-glass' },
    },
    {
      key: 'flutedGlassBlur',
      label: '玻璃模糊',
      min: 0,
      max: 1,
      step: 0.02,
      when: { key: 'effect', value: 'fluted-glass' },
    },
    {
      key: 'paperTextureContrast',
      label: '纸张对比',
      min: 0,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'paper-texture' },
    },
    {
      key: 'paperTextureRoughness',
      label: '纸张粗糙度',
      min: 0,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'paper-texture' },
    },
    {
      key: 'paperTextureFiber',
      label: '纸张纤维',
      min: 0,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'paper-texture' },
    },
    {
      key: 'halftoneDotsSize',
      label: '网点尺寸',
      min: 0,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'halftone-dots' },
    },
    {
      key: 'halftoneDotsRadius',
      label: '网点半径',
      min: 0.1,
      max: 2,
      step: 0.05,
      when: { key: 'effect', value: 'halftone-dots' },
    },
    {
      key: 'halftoneDotsContrast',
      label: '网点对比',
      min: 0,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'halftone-dots' },
    },
    {
      key: 'halftoneDotsOriginalColors',
      label: '网点原色',
      when: { key: 'effect', value: 'halftone-dots' },
    },
    {
      key: 'halftoneDotsInverted',
      label: '网点反色',
      when: { key: 'effect', value: 'halftone-dots' },
    },
    {
      key: 'lensDistortionSpread',
      label: '镜头散射',
      min: 0,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'lens-distortion' },
    },
    {
      key: 'lensDistortionBulge',
      label: '镜头弯曲',
      min: -1,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'lens-distortion' },
    },
    {
      key: 'lensDistortionDispersion',
      label: '色散',
      min: 0,
      max: 1,
      step: 0.05,
      when: { key: 'effect', value: 'lens-distortion' },
    },
    { key: 'overlayEnabled', label: '主题遮罩' },
    { key: 'overlayOpacity', label: '遮罩强度', min: 0, max: 1, step: 0.05 },
  ],
}
export const isBackgroundMode = (mode: string): mode is BackgroundMode =>
  Object.prototype.hasOwnProperty.call(backgroundDefaults, mode)

/** Persisted data is untrusted. Keep only finite, bounded values and known enum choices. */
export function resolveBackgroundTuning<M extends BackgroundMode>(
  mode: M,
  input?: unknown
): (typeof backgroundDefaults)[M] {
  const defaults = backgroundDefaults[mode]
  const result: Record<string, unknown> = { ...defaults }
  if (!input || typeof input !== 'object') return result as typeof defaults
  const values = input as Record<string, unknown>
  for (const control of backgroundControls[mode]) {
    const value = values[control.key]
    const fallback = result[control.key]
    if (typeof fallback === 'boolean' && typeof value === 'boolean')
      result[control.key] = value
    else if (
      typeof fallback === 'number' &&
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      result[control.key] = Math.max(
        control.min ?? 0,
        Math.min(control.max ?? 1, value)
      )
    } else if (
      typeof fallback === 'string' &&
      typeof value === 'string' &&
      (!control.options || control.options.includes(value))
    )
      result[control.key] = value
  }
  return result as typeof defaults
}

export function sanitizeBackgroundUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
