// 在不丢弃仍需可定位（seekable）的显示树的前提下，释放渲染器持有的数据。
// 从 Folia pixiDisplayResources.ts 移植。
export interface PixiDisplayNode {
  children?: PixiDisplayNode[]
  visible?: boolean
  /** Graphics 的 GraphicsContext：大号（不走合批）的 context 各自持有 batcher 与顶点/索引缓冲。 */
  context?: { unload?: () => void }
  unload?: () => void
  destroy?: () => void
}

export function unloadPixiDisplayTree(root: PixiDisplayNode): void {
  const stack = [...(root.children ?? [])]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.children?.length) stack.push(...node.children)
    // Graphics.unload() 只放视图自己的批数据，缓冲挂在 context 上，要单独 unload；
    // 再画到它时 Pixi 自动重建、重传。共享的 context 也只是被迫重传一次，不会画错。
    node.context?.unload?.()
    node.unload?.()
  }
}

/** 保留的 Pixi 树离开可见集合时，恰好卸载后代一次。 */
export function setPixiDisplayTreeVisibility(
  root: PixiDisplayNode,
  visible: boolean
): void {
  const wasVisible = root.visible !== false
  root.visible = visible
  if (wasVisible && !visible) unloadPixiDisplayTree(root)
}

/**
 * 销毁整棵显示树，Graphics 自建的 GraphicsContext 一并销毁，构造时传进来的共享 context 不动。
 *
 * 不能用 destroy({ children: true })：Container 会把这份选项原样传给子节点，
 * 而 Pixi 8 的 Graphics.destroy 只要收到选项对象、却没写 context: true，就不销毁自建的 context，
 * 它的 GPU 批数据要等 Pixi 的 GC 空闲 60 秒才收；写 context: true 又会把共享的 context 一起销毁。
 * 所以逐个节点不带参数 destroy() —— Graphics 只在这时按归属销毁自建的 context；
 * 其余节点不带参数与 { children: true } 一样，都不动纹理。
 */
export function destroyPixiDisplayTree(root: PixiDisplayNode): void {
  // 先序收集再倒着销毁：子节点总在父节点之前，父节点 destroy() 时已经没有子节点要处理。
  const order: PixiDisplayNode[] = []
  const stack = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    order.push(node)
    if (node.children?.length) stack.push(...node.children)
  }
  for (let index = order.length - 1; index >= 0; index -= 1)
    order[index]!.destroy?.()
}

/** removeChildren() 只是摘下节点；摘下来的子树要显式 unload 并 destroy。 */
export function destroyPixiContainerChildren(
  container: PixiDisplayNode & { removeChildren: () => PixiDisplayNode[] }
): void {
  container.removeChildren().forEach(destroyPixiDisplayTree)
}
