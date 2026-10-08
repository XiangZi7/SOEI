# SOEI UI 组件库

技术：Vue 3 `<script setup lang="ts">`、Tailwind CSS v4。组件均有类型约束，视觉取自 `src/styles/tokens.css`，不依赖远程图标或字体。

| 组件         | 主要接口                                                                | 用途                                           |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------------- |
| UiButton     | variant: outline / solid / ghost / text / icon；size；loading；disabled | 通用按钮                                       |
| UiIconButton | icon；label（必填）；active；iconSize                                   | 具备可访问名称的图标按钮                       |
| UiInput      | v-model；label；type；placeholder                                       | 文字、搜索、数值输入                           |
| UiSelect     | v-model；label；options 或 option slot                                  | 选择器                                         |
| UiSwitch     | v-model:boolean；label；disabled                                        | 设置开关                                       |
| UiSlider     | v-model:number；label；min / max / step                                 | 进度、音量与字号                               |
| UiPanel      | glass；padding                                                          | 小范围毛玻璃面板                               |
| UiDialog     | title；close 事件                                                       | 原生模态弹窗，含焦点限制、Esc 与关闭后焦点恢复 |
| UiBadge      | tone: neutral / accent / danger                                         | 简短状态                                       |
| AppIcon      | name；size                                                              | 本地 Lucide 图标子集                           |

```vue
<script setup lang="ts">
import { UiButton, UiSwitch, AppIcon } from '../../components/ui'
</script>
<template>
  <UiButton variant="solid"><AppIcon name="plus" />导入音乐</UiButton>
  <UiSwitch
    v-model="settings.reducedMotion"
    label="减少动态效果"
  />
</template>
```

项目使用相对导入，请按文件位置引用 `components/ui`。例如页面目录中可用 `../../components/ui`。运行后访问 `/ui` 查看和操作组件，`/` 的设置、播放器和画廊都已复用这些组件。

## 主题和 class

- `@theme` 生成 `bg-canvas`、`bg-panel`、`text-ink`、`text-muted`、`border-line`、`font-display`、`rounded-panel`、`shadow-panel`、`text-caption`、`text-label`、`size-control` 等 Tailwind 工具类。
- `utilities.css` 提供 `flex-center`、`flex-between`、`truncate-text`、`safe-page`、`touch-target`。
- `icon-button`、`quiet-button`、`glass-panel`、`eyebrow`、`field-input`、`field-select` 是语义 class；业务页面优先使用对应 UI 组件。
- 动画参数使用 `--motion-hover`、`--motion-scene`、`--motion-ambient`；页面不自行定义另一套时长。
- 新的视觉颜色先加入主题，不在组件写裸十六进制色值。封面环境色属于媒体数据，可按歌曲覆盖。
- `UiButton`、`UiInput`、`UiSelect`、`UiPanel` 通过 `tailwind-merge` 合并 class：调用方的布局、间距、颜色可以覆盖默认值，自定义字号仍与颜色工具类共存。
