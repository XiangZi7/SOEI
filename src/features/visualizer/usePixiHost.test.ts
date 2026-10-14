import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'
import { usePixiHost } from './usePixiHost'

interface FakeSong {
  id: string
}
interface FakeRuntime {
  id: number
  songs: string[]
}

/**
 * 项目的 vitest 跑在 environment: 'node'（没有 DOM），而宿主只把挂载点当不透明句柄传给 create，
 * 外加销毁时调一次 replaceChildren()。所以用桩元素即可，不必为此引入 jsdom。
 */
function stubElement() {
  const element = {
    cleared: 0,
    replaceChildren() {
      element.cleared += 1
    },
  }
  return element as unknown as HTMLElement & { cleared: number }
}

/** 可控的 create/swap/destroy 三件套，记录调用顺序。 */
function harness(options?: {
  createDelay?: () => Promise<void>
  failCreate?: boolean
}) {
  let nextId = 1
  const created: FakeRuntime[] = []
  const destroyed: FakeRuntime[] = []
  const swapped: string[] = []
  let releaseSwap: (() => void) | undefined
  return {
    created,
    destroyed,
    swapped,
    /** 让下一次 swap 挂住，用来模拟「交接还没完就又跳歌」。 */
    holdSwap() {
      return new Promise<void>(resolve => {
        releaseSwap = resolve
      })
    },
    release() {
      releaseSwap?.()
      releaseSwap = undefined
    },
    async create(_host: HTMLElement, song: FakeSong) {
      await options?.createDelay?.()
      if (options?.failCreate) throw new Error('boom')
      const runtime: FakeRuntime = { id: nextId++, songs: [song.id] }
      created.push(runtime)
      return runtime
    },
    async swap(runtime: FakeRuntime, song: FakeSong) {
      const hold = releaseSwap
        ? new Promise<void>(resolve => {
            releaseSwap = resolve
          })
        : undefined
      if (hold) await hold
      runtime.songs.push(song.id)
      swapped.push(song.id)
    },
    destroy(runtime: FakeRuntime) {
      destroyed.push(runtime)
    },
  }
}

describe('Pixi 宿主生命周期', () => {
  it('只创建一次；换歌走原地交接而不是重建', async () => {
    const scope = effectScope()
    const host = shallowRef<HTMLElement | null>(stubElement())
    const song = shallowRef<FakeSong>({ id: 'a' })
    const fake = harness()
    scope.run(() =>
      usePixiHost({
        host,
        label: 'Test',
        rebuildKey: () => [],
        song: () => song.value,
        create: fake.create,
        swap: fake.swap,
        destroy: fake.destroy,
      })
    )
    await nextTick()
    await Promise.resolve()
    expect(fake.created).toHaveLength(1)

    song.value = { id: 'b' }
    await nextTick()
    await Promise.resolve()
    expect(fake.created).toHaveLength(1)
    expect(fake.swapped).toEqual(['b'])
    expect(fake.destroyed).toHaveLength(0)
    scope.stop()
  })

  it('跳歌比交接快时向最新曲目收敛，不逐首补演', async () => {
    const scope = effectScope()
    const host = shallowRef<HTMLElement | null>(stubElement())
    const song = shallowRef<FakeSong>({ id: 'a' })
    const fake = harness()
    scope.run(() =>
      usePixiHost({
        host,
        label: 'Test',
        rebuildKey: () => [],
        song: () => song.value,
        create: fake.create,
        swap: fake.swap,
        destroy: fake.destroy,
      })
    )
    await nextTick()
    await Promise.resolve()

    // 挂住第一次交接，期间连跳三首。
    void fake.holdSwap()
    song.value = { id: 'b' }
    await nextTick()
    song.value = { id: 'c' }
    await nextTick()
    song.value = { id: 'd' }
    await nextTick()
    fake.release()
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // b 的交接已经在飞；之后应当直接跳到 d，不应出现 c。
    expect(fake.swapped).not.toContain('c')
    expect(fake.swapped[fake.swapped.length - 1]).toBe('d')
    scope.stop()
  })

  it('rebuildKey 变化才销毁并重建 runtime', async () => {
    const scope = effectScope()
    const host = shallowRef<HTMLElement | null>(stubElement())
    const quality = ref('high')
    const fake = harness()
    scope.run(() =>
      usePixiHost({
        host,
        label: 'Test',
        rebuildKey: () => [quality.value],
        song: () => ({ id: 'a' }),
        create: fake.create,
        swap: fake.swap,
        destroy: fake.destroy,
      })
    )
    await nextTick()
    await Promise.resolve()
    expect(fake.created).toHaveLength(1)

    quality.value = 'low'
    await nextTick()
    await Promise.resolve()
    expect(fake.destroyed).toHaveLength(1)
    expect(fake.created).toHaveLength(2)
    scope.stop()
  })

  it('销毁作用域时销毁 runtime 并清空挂载点', async () => {
    const scope = effectScope()
    const element = stubElement()
    const host = shallowRef<HTMLElement | null>(element)
    const fake = harness()
    scope.run(() =>
      usePixiHost({
        host,
        label: 'Test',
        rebuildKey: () => [],
        song: () => ({ id: 'a' }),
        create: fake.create,
        swap: fake.swap,
        destroy: fake.destroy,
      })
    )
    await nextTick()
    await Promise.resolve()

    scope.stop()
    expect(fake.destroyed).toHaveLength(1)
    expect(element.cleared).toBe(1)
  })

  it('create 在销毁之后才 resolve 时，孤儿 runtime 也会被销毁', async () => {
    const scope = effectScope()
    const host = shallowRef<HTMLElement | null>(stubElement())
    let releaseCreate: (() => void) | undefined
    const fake = harness({
      createDelay: () =>
        new Promise<void>(resolve => {
          releaseCreate = resolve
        }),
    })
    scope.run(() =>
      usePixiHost({
        host,
        label: 'Test',
        rebuildKey: () => [],
        song: () => ({ id: 'a' }),
        create: fake.create,
        swap: fake.swap,
        destroy: fake.destroy,
      })
    )
    await nextTick()
    // create 还挂着就销毁作用域。
    scope.stop()
    expect(fake.created).toHaveLength(0)

    releaseCreate?.()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(fake.created).toHaveLength(1)
    expect(fake.destroyed).toEqual(fake.created)
  })

  it('create 失败时上报，让模式能显示纯文字兜底', async () => {
    const scope = effectScope()
    const host = shallowRef<HTMLElement | null>(stubElement())
    const fake = harness({ failCreate: true })
    const onFailedChange = vi.fn()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    scope.run(() =>
      usePixiHost({
        host,
        label: 'Test',
        rebuildKey: () => [],
        song: () => ({ id: 'a' }),
        create: fake.create,
        swap: fake.swap,
        destroy: fake.destroy,
        onFailedChange,
      })
    )
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    expect(onFailedChange).toHaveBeenCalledWith(false)
    expect(onFailedChange).toHaveBeenLastCalledWith(true)
    error.mockRestore()
    scope.stop()
  })

  it('挂载点还不存在时不创建，出现后再创建', async () => {
    const scope = effectScope()
    const host = shallowRef<HTMLElement | null>(null)
    const fake = harness()
    scope.run(() =>
      usePixiHost({
        host,
        label: 'Test',
        rebuildKey: () => [],
        song: () => ({ id: 'a' }),
        create: fake.create,
        swap: fake.swap,
        destroy: fake.destroy,
      })
    )
    await nextTick()
    await Promise.resolve()
    expect(fake.created).toHaveLength(0)

    host.value = stubElement()
    await nextTick()
    await Promise.resolve()
    expect(fake.created).toHaveLength(1)
    scope.stop()
  })
})
