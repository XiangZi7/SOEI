// 限定按需模块的导出，避免将 Three.js 未使用的功能带入背景光场。
export {
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'
