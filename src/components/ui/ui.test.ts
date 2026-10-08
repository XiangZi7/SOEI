import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import UiButton from './UiButton.vue'
import UiIconButton from './UiIconButton.vue'
import UiInput from './UiInput.vue'
import { mergeUiClasses } from './classes'

describe('UI 组件公共接口', () => {
  it('调用方可以覆盖布局，语义字号与文字颜色共存', () => {
    expect(
      mergeUiClasses(
        'inline-flex gap-2 text-label text-ink',
        'flex gap-5 text-muted'
      )
    ).toBe('text-label flex gap-5 text-muted')
  })
  it('按钮透传属性，加载中禁用且不会意外提交表单', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(UiButton, { loading: true, 'aria-label': '导入', class: 'px-0' }),
      })
    )
    expect(html).toContain('type="button"')
    expect(html).toContain('disabled')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-label="导入"')
    expect(html).toContain('px-0')
    expect(html).not.toContain('px-4')
  })
  it('图标按钮有可访问名称和按下状态', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(UiIconButton, { icon: 'heart', label: '取消收藏', active: true }),
      })
    )
    expect(html).toContain('aria-label="取消收藏"')
    expect(html).toContain('aria-pressed="true"')
  })
  it('普通图标操作保留按钮语义', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => h(UiIconButton, { icon: 'x', label: '关闭' }),
      })
    )
    expect(html).not.toContain('aria-pressed')
  })
  it('输入框保留值、原生约束和调用方样式', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(UiInput, {
            label: '偏移',
            type: 'number',
            modelValue: 100,
            min: -30000,
            class: 'bg-transparent',
          }),
      })
    )
    expect(html).toContain('value="100"')
    expect(html).toContain('min="-30000"')
    expect(html).toContain('bg-transparent')
    expect(html).not.toContain('bg-surface')
  })
})
