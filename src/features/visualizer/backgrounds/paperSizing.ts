import type {
  ShaderSizingParams,
  ShaderSizingUniforms,
} from '@paper-design/shaders'
export function paperSizing(
  sizing: Required<ShaderSizingParams>,
  fit: 0 | 1 | 2 = 2
): ShaderSizingUniforms {
  return {
    u_fit: fit,
    u_scale: sizing.scale,
    u_rotation: sizing.rotation,
    u_originX: sizing.originX,
    u_originY: sizing.originY,
    u_offsetX: sizing.offsetX,
    u_offsetY: sizing.offsetY,
    u_worldWidth: sizing.worldWidth,
    u_worldHeight: sizing.worldHeight,
  }
}
