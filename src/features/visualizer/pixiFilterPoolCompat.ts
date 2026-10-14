import type { BindGroup, Texture } from 'pixi.js'

// Pixi 会在 FilterSystem 仍然绑着上一个 pass 的纹理时，就把全屏尺寸的纹理从池里剪掉，
// 于是那一帧采到已销毁的纹理。上游修复见 https://github.com/pixijs/pixijs/pull/12259。
//
// 从 Folia pixiFilterPoolCompat.ts 移植。**唯一的改动是触发条件**：
// 上游写的是精确版本门控 `if (pixi.VERSION !== '8.21.0') return`，而 SOEI 装的是 8.22.0，
// 那条门控会让补丁变成空操作。实际核对 8.22.0 的源码：
//   - `FilterSystem.destroy()` 只销毁 passthrough filter，没有解绑或销毁 _globalFilterBindGroup
//   - `TexturePool._dropTextures()` 照旧直接 texture.destroy(true)，不通知任何绑定方
// 也就是上游修复并未进入 8.22.0，补丁依然必需。
//
// 所以这里改成按「要打的内部字段是否存在」来判断，而不是比版本号：
//   - 修复进入某个未来版本后，补丁多做一次解绑，而那些 bind group 下一帧本来就要重绑，无副作用
//   - 这些字段都是私有的，一旦被重命名，补丁安静跳过，而不是抛错或静默打错位置
type PixiModule = typeof import('pixi.js')
const PATCHED = Symbol.for('soei.pixiFilterPoolCompat')

interface FilterSystemCompat {
  _globalFilterBindGroup: BindGroup
  init?: () => void
  destroy: () => void
  [PATCHED]?: boolean
}

interface TexturePoolCompat {
  _poolKey: Record<number, number | undefined>
  _buckets: Map<number, Texture[]>
  _dropTextures: (textures: Texture[], destroy: boolean) => void
  returnTexture: (texture: Texture, resetStyle?: boolean) => void
}

/** 池销毁纹理之前先解绑所有活跃渲染器；正常绘制不受影响。 */
export function installPixiFilterPoolCompat(pixi: PixiModule): void {
  const prototype = pixi.FilterSystem?.prototype as unknown as
    FilterSystemCompat | undefined
  const pool = pixi.TexturePool as unknown as TexturePoolCompat | undefined
  if (!prototype || !pool) return
  // 补丁要改写的四处私有实现必须都在，否则跳过。
  if (
    typeof pool._dropTextures !== 'function' ||
    typeof pool.returnTexture !== 'function' ||
    !pool._poolKey ||
    !pool._buckets
  )
    return
  if (prototype[PATCHED]) return
  prototype[PATCHED] = true

  const groups = new Set<BindGroup>()
  const unbindPassTextures = () => {
    const source = pixi.Texture.EMPTY.source
    groups.forEach(group => {
      group.setResource(source, 1)
      group.setResource(source.style, 2)
      group.setResource(source, 3)
    })
  }

  // init 会被 Pixi 的 renderer runner 在任何 filter 渲染之前取到。
  // 8.22.0 的 FilterSystem 自身没有 init，但 'init' 在 defaultRunners 里，
  // 而这里定义到 prototype 上就足以让该系统进入 init runner。
  const init = prototype.init
  prototype.init = function () {
    init?.call(this)
    groups.add(this._globalFilterBindGroup)
  }
  const destroy = prototype.destroy
  prototype.destroy = function () {
    groups.delete(this._globalFilterBindGroup)
    this._globalFilterBindGroup.destroy()
    destroy.call(this)
  }

  // 尺寸变化、渲染器销毁和 clear() 都通过这个方法丢弃空闲纹理。
  const dropTextures = pool._dropTextures
  pool._dropTextures = function (textures, shouldDestroy) {
    if (shouldDestroy && textures.length > 0) unbindPassTextures()
    dropTextures.call(this, textures, shouldDestroy)
  }
  // 已借出的纹理可能活得比它的桶久，归还时会被直接销毁。
  const returnTexture = pool.returnTexture
  pool.returnTexture = function (texture, resetStyle) {
    const key = this._poolKey[texture.uid]
    if (key !== undefined && !this._buckets.has(key)) unbindPassTextures()
    returnTexture.call(this, texture, resetStyle)
  }
}
