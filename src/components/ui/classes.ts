import { normalizeClass, useAttrs } from 'vue'
import { extendTailwindMerge } from 'tailwind-merge'

// 自定义字号须归入 font-size，避免 text-label 与 text-muted 被误判为同一组。
export const mergeUiClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'label'] }],
      rounded: [{ rounded: ['input', 'panel'] }],
    },
  },
})

/** 保留事件和原生属性，让调用方的 Tailwind class 覆盖组件默认值。 */
export function useUiAttrs() {
  const attrs = useAttrs()
  function forwardedAttrs() {
    const { class: _class, ...rest } = attrs
    return rest
  }
  function classes(...values: unknown[]) {
    return mergeUiClasses(normalizeClass(values), normalizeClass(attrs.class))
  }
  return { forwardedAttrs, classes }
}
