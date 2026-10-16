// Adapted from Folia NomandBackgroundLayer.tsx (AGPL-3.0).
import {
  defaultObjectSizing,
  getShaderColorFromString,
  imageDitheringFragmentShader,
  flutedGlassFragmentShader,
  paperTextureFragmentShader,
  halftoneDotsFragmentShader,
  lensDistortionFragmentShader,
  DitheringTypes,
  GlassGridShapes,
  GlassDistortionShapes,
  HalftoneDotsGrids,
  HalftoneDotsTypes,
} from '@paper-design/shaders'
import type { Theme } from '../../../theme/model'
import type { NomandBackgroundTuning } from '../model'
import type { PaperShaderConfig } from '../usePaperShader'
import { paperSizing } from '../paperSizing'
import {
  NOMAND_LENS_SHAPE,
  NOMAND_PAPER_TEXTURE_SHAPE,
  getPaperTextureOverscan,
  getLensDistortionOverscan,
  resolveDaylightInversion,
  resolveHalftoneInversion,
} from './nomandShaderAdjustments'
export function nomandShader(
  tuning: NomandBackgroundTuning,
  theme: Theme,
  isDaylight = false
): PaperShaderConfig {
  const base = {
    ...paperSizing(defaultObjectSizing),
    u_colorBack: getShaderColorFromString(theme.backgroundColor),
    u_colorFront: getShaderColorFromString(theme.accentColor),
  }
  switch (tuning.effect) {
    case 'fluted-glass':
      return {
        fragment: flutedGlassFragmentShader,
        uniforms: {
          ...base,
          u_colorShadow: getShaderColorFromString(theme.secondaryColor),
          u_colorHighlight: getShaderColorFromString(theme.primaryColor),
          u_shadows: 0.25,
          u_size: tuning.flutedGlassSize,
          u_distortion: tuning.flutedGlassDistortion,
          u_blur: tuning.flutedGlassBlur,
          u_shape: GlassGridShapes.lines,
          u_distortionShape: GlassDistortionShapes.prism,
          u_highlights: 0.1,
          u_edges: 0.25,
          u_angle: 0,
          u_shift: 0,
          u_marginLeft: 0,
          u_marginRight: 0,
          u_marginTop: 0,
          u_marginBottom: 0,
          u_stretch: 0,
          u_grainMixer: 0,
          u_grainOverlay: 0,
        },
      }
    case 'paper-texture':
      return {
        fragment: paperTextureFragmentShader,
        uniforms: {
          ...base,
          ...Object.fromEntries(
            Object.entries(NOMAND_PAPER_TEXTURE_SHAPE).map(([key, value]) => [
              'u_' + key,
              value,
            ])
          ),
          u_contrast: tuning.paperTextureContrast,
          u_roughness: tuning.paperTextureRoughness,
          u_fiber: tuning.paperTextureFiber,
          u_fade: 0,
          u_scale: getPaperTextureOverscan(
            tuning.paperTextureRoughness,
            tuning.paperTextureFiber
          ),
        },
      }
    case 'halftone-dots':
      return {
        fragment: halftoneDotsFragmentShader,
        uniforms: {
          ...base,
          u_size: tuning.halftoneDotsSize,
          u_radius: tuning.halftoneDotsRadius,
          u_contrast: tuning.halftoneDotsContrast,
          u_originalColors: tuning.halftoneDotsOriginalColors,
          u_inverted: resolveHalftoneInversion(
            tuning.halftoneDotsInverted,
            tuning.halftoneDotsOriginalColors,
            isDaylight
          ),
          u_grid: HalftoneDotsGrids.hex,
          u_type: HalftoneDotsTypes.gooey,
          u_grainMixer: 0.12,
          u_grainOverlay: 0.06,
          u_grainSize: 0.5,
        },
      }
    case 'lens-distortion':
      return {
        fragment: lensDistortionFragmentShader,
        uniforms: {
          ...base,
          ...Object.fromEntries(
            Object.entries(NOMAND_LENS_SHAPE).map(([key, value]) => [
              'u_' + key,
              value,
            ])
          ),
          u_spread: tuning.lensDistortionSpread,
          u_dispersion: tuning.lensDistortionDispersion,
          u_lensBulge: tuning.lensDistortionBulge,
          u_scale: getLensDistortionOverscan(
            tuning.lensDistortionBulge,
            tuning.lensDistortionSpread
          ),
          u_bias: 0,
          u_angle: 0,
          u_dispersionShift: 0,
          u_dispersionColor: 0,
          u_noise: 0,
          u_noiseFrequency: 0,
          u_noiseOffset: 0,
          u_grainMixer: 0,
          u_grainOverlay: 0,
          u_imageX: 0,
          u_imageY: 0,
        },
      }
    default:
      return {
        fragment: imageDitheringFragmentShader,
        uniforms: {
          ...base,
          u_colorHighlight: getShaderColorFromString(theme.primaryColor),
          u_originalColors: tuning.originalColors,
          u_inverted: resolveDaylightInversion(
            tuning.inverted,
            tuning.originalColors,
            isDaylight
          ),
          u_type: DitheringTypes[tuning.ditheringType],
          u_pxSize: tuning.size,
          u_colorSteps: tuning.colorSteps,
        },
      }
  }
}
