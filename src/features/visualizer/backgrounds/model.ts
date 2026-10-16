// Adapted from Folia (AGPL-3.0); see third_party/Folia-NOTICE.md.
export type MonetBackgroundSource = 'cover-derived' | 'uploaded-global'
export type MonetBackgroundLayout = 'full-overlay' | 'half-pane-gradient'
export type MonetBackgroundWashColorMode = 'theme' | 'custom'
export type NomandBackgroundSource = 'cover-derived' | 'uploaded-global'
export type NomandBackgroundDitheringType = '2x2' | '4x4' | '8x8'
export type NomandBackgroundEffect =
  | 'dithering'
  | 'fluted-glass'
  | 'paper-texture'
  | 'halftone-dots'
  | 'lens-distortion'
export type LatentBackgroundDisplayMode = 'dithering' | 'mesh' | 'both'
export type LatentBackgroundColorSource = 'cover-theme' | 'cover-only'
export type MonetAudioStyle = 'bar' | 'line'
export type MonetPortraitSource = 'cover' | 'custom'
export type BuiltinVisualizerBackgroundMode =
  'common' | 'monet' | 'nomand' | 'latent' | 'url' | 'sora'
export type VisualizerBackgroundMode =
  BuiltinVisualizerBackgroundMode | (string & {})

export interface UrlBackgroundItem {
  id: string
  url: string
  note: string
}

export interface MonetBackgroundTuning {
  backgroundSource: MonetBackgroundSource
  backgroundLayout: MonetBackgroundLayout
  backgroundBlurPx: number
  backgroundOverlayOpacity: number
  backgroundGrayscale: number
  backgroundSaturation: number
  backgroundWash: number
  backgroundHalfPaneOffsetX: number
  backgroundWashColorMode: MonetBackgroundWashColorMode
  backgroundWashCustomColor: string
  /** 整张背景图的缓慢缩放漂移；纯 CSS 合成层动画，不参与背景烘焙。 */
  backgroundDriftEnabled: boolean
  /** 漂移幅度 0..1，同时决定位移距离和为防止露边而预放大的倍率。 */
  backgroundDriftStrength: number
  /** 是否在烘焙的 overlay 里绘制那几条 1px 竖向纹理。 */
  backgroundStreaksEnabled: boolean
}

export interface NomandBackgroundTuning {
  imageSource: NomandBackgroundSource
  effect: NomandBackgroundEffect
  ditheringType: NomandBackgroundDitheringType
  size: number
  colorSteps: number
  originalColors: boolean
  inverted: boolean
  flutedGlassSize: number
  flutedGlassDistortion: number
  flutedGlassBlur: number
  paperTextureContrast: number
  paperTextureRoughness: number
  paperTextureFiber: number
  halftoneDotsSize: number
  halftoneDotsRadius: number
  halftoneDotsContrast: number
  halftoneDotsOriginalColors: boolean
  halftoneDotsInverted: boolean
  lensDistortionSpread: number
  lensDistortionBulge: number
  lensDistortionDispersion: number
  overlayEnabled: boolean
  overlayOpacity: number
}

export interface LatentBackgroundTuning {
  displayMode: LatentBackgroundDisplayMode
  colorSource: LatentBackgroundColorSource
  dynamicOnlyInPlayer: boolean
  enhancedBeatResponse: boolean
  ditheringSpeed: number
  ditheringAudioSpeed: number
  ditheringSize: number
  ditheringOpacity: number
  meshSpeed: number
  meshAudioSpeed: number
  meshDistortion: number
  meshSwirl: number
  overlayEnabled: boolean
  overlayOpacity: number
}

export interface SoraBackgroundTuning {
  /** Skips the WebGL starfield and shows a static solid black (night) / white (daylight) frame. */
  blank: boolean
}

export interface MonetTuning {
  keywordColoringEnabled: boolean
  showDescription: boolean
  showAudioVisualization: boolean
  audioStyle: MonetAudioStyle
  fontScale: number
  portraitSource: MonetPortraitSource
  portraitOffsetX?: number
  portraitStyle?: 'square' | 'rectangular'
  showPortraitDragHanger?: boolean
}

export const DEFAULT_MONET_BACKGROUND_TUNING: MonetBackgroundTuning = {
  backgroundSource: 'cover-derived',
  backgroundLayout: 'full-overlay',
  backgroundBlurPx: 6,
  backgroundOverlayOpacity: 0.74,
  backgroundGrayscale: 0,
  backgroundSaturation: 1.05,
  backgroundWash: 0.34,
  backgroundHalfPaneOffsetX: 0,
  backgroundWashColorMode: 'theme',
  backgroundWashCustomColor: '#8fb7ff',
  backgroundDriftEnabled: true,
  backgroundDriftStrength: 0.5,
  backgroundStreaksEnabled: true,
}

export const DEFAULT_NOMAND_BACKGROUND_TUNING: NomandBackgroundTuning = {
  imageSource: 'cover-derived',
  effect: 'dithering',
  ditheringType: '8x8',
  size: 3,
  colorSteps: 4,
  originalColors: false,
  inverted: false,
  flutedGlassSize: 0.5,
  flutedGlassDistortion: 0.5,
  flutedGlassBlur: 0.08,
  paperTextureContrast: 0.32,
  paperTextureRoughness: 0.42,
  paperTextureFiber: 0.3,
  halftoneDotsSize: 0.5,
  halftoneDotsRadius: 1.25,
  halftoneDotsContrast: 0.4,
  halftoneDotsOriginalColors: false,
  halftoneDotsInverted: false,
  lensDistortionSpread: 0.45,
  lensDistortionBulge: 0.3,
  lensDistortionDispersion: 0.65,
  overlayEnabled: true,
  overlayOpacity: 0.35,
}

export const DEFAULT_LATENT_BACKGROUND_TUNING: LatentBackgroundTuning = {
  displayMode: 'both',
  colorSource: 'cover-theme',
  dynamicOnlyInPlayer: true,
  enhancedBeatResponse: true,
  ditheringSpeed: 0.1,
  ditheringAudioSpeed: 1.2,
  ditheringSize: 2.5,
  ditheringOpacity: 0.55,
  meshSpeed: 0.3,
  meshAudioSpeed: 2,
  meshDistortion: 0.8,
  meshSwirl: 0.1,
  overlayEnabled: true,
  overlayOpacity: 0.35,
}

export const DEFAULT_SORA_BACKGROUND_TUNING: SoraBackgroundTuning = {
  blank: false,
}

export const DEFAULT_MONET_TUNING: MonetTuning = {
  keywordColoringEnabled: true,
  showDescription: true,
  showAudioVisualization: true,
  audioStyle: 'bar',
  fontScale: 1.2,
  portraitSource: 'cover',
  portraitOffsetX: 0,
  portraitStyle: 'square',
  showPortraitDragHanger: true,
}

export interface MonetBackgroundImage {
  id: string
  name: string
  url: string
}
