# 歌词引擎：时间轴与分镜

2026-10-09。本次实际读取用户提供的 `D:\code\ck` 中两个仓库，参考其时间模型与模块边界，在 SOEI 现有 Vue / Tauri 架构内独立实现。

## 源码对照

| 参考 | 实际阅读的源码 | SOEI 的实现 |
| --- | --- | --- |
| Folia `c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67` | [temperaMotion.ts](https://github.com/chthollyphile/folia-major/blob/c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67/src/components/visualizer/tempera/temperaMotion.ts)、[temperaProgram.ts](https://github.com/chthollyphile/folia-major/blob/c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67/src/components/visualizer/tempera/temperaProgram.ts) | 由绝对播放时间计算动效；词时间与入场、停留、退场时间分离，Seek 无需重演历史帧 |
| Folia 字素时间模型 | [graphemeTiming.ts](https://github.com/chthollyphile/folia-major/blob/c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67/src/utils/lyrics/graphemeTiming.ts) | 保留 Enhanced LRC 词边界，词内以完整字素均分，保护组合音标和 ZWJ emoji；未标时标点不独占演唱区间 |
| JIZURA `fc16bfe43ea4a6c25a21f1caf04d17326de14f00` | [05_anim.js](https://github.com/852wa/JIZURA/blob/fc16bfe43ea4a6c25a21f1caf04d17326de14f00/src/05_anim.js)、[05b_registry.js](https://github.com/852wa/JIZURA/blob/fc16bfe43ea4a6c25a21f1caf04d17326de14f00/src/05b_registry.js) | 布局与动效解耦，提供轻移、遮罩、轻缩放、抬升四种克制组合，镜头持留采用两端归零的包络 |
| JIZURA 规划与渲染 | [08_planner.js](https://github.com/852wa/JIZURA/blob/fc16bfe43ea4a6c25a21f1caf04d17326de14f00/src/08_planner.js)、[09_render.js](https://github.com/852wa/JIZURA/blob/fc16bfe43ea4a6c25a21f1caf04d17326de14f00/src/09_render.js) | 按句子时长和文本长度限制动效；预先规划，再按局部播放时间求值。SOEI 使用更长的阅读预算，不采用上游估算节拍覆盖真实词时间 |

Folia 为 AGPL-3.0，JIZURA 为 MIT（2026 hakoniwa）。未复制二者源码或媒体素材；本次没有引入二者依赖或构建系统。

## 数据与组件边界

- `features/lyrics/lrc.ts`：解析行与可选的词时间，统一使用毫秒。支持重复行标签、文件 offset；坏的词标签降级为普通歌词，正文仍然保留。
- `features/lyrics/useLyricClock.ts`：在本地投影播放器位置，播放中最多外推 500ms。暂停、Seek、换歌和会话切换重新校准；隐藏或卸载后停止 RAF。高频时间不写入 Pinia。
- `features/lyrics/glyphTiming.ts`：一次性把词区间映射到显示字素。长句合并显示时仍保留对应时间区间，无法可靠对齐时取消高亮。
- `features/visual/lyricStoryboard.ts` 与 `KineticLyrics.vue`：负责确定性排版与容器适配；不在每帧重新分词或测量文字。
- `features/visual/lyricMotion.ts`：规划时间预算，以纯函数返回字素、镜头和笔划的当前帧。同一时间、同一分镜种子得到同一结果。
- `features/visual/useLyricTransitions.ts`：缓存当前节点，字素样式仅在值变化时写入。Vue 管理节点生命周期，浏览器短淡出用于节点交替；快速 Seek 直接移除旧画面，连续切句最多保留一个离场节点。
- `features/visual/ImmersiveScene.vue`：将歌曲、歌词偏移、时钟和画面组合起来。从首页打开的视觉预览使用独立时钟，不修改真实歌曲进度。

## 时间与阅读规则

普通 LRC 的逐字动画是视觉入场，不代表演唱时间。只有 Enhanced LRC 提供了有效的词时间，才显示扫色与轻微的当前字素强调；词内细分属于字素插值，并非额外识别出的音素时间。

```lrc
[00:01.00]<00:01.00>你好<00:03.00>世界<00:05.00>
```

此例第一组为 1–3 秒，第二组为 3–5 秒。尾标签限定扫色结束；下一句之前的长空档不会拉长已明确的词时间。缺少末词结束标签时使用下一句或歌曲结束作为边界。

小于 450ms 的句子直接静止显示；句长大于等于 450ms 且小于 1000ms 时禁用错峰和持留运动。其他普通歌词的入场（含最后字素的错峰）与退场合计最多占句长 40%，至少保留 60% 完整阅读时间。末词尚未完成时，缩短或取消退场。减少动态效果时完整显示文字，保留准确的逐词进度。

默认动态分镜仍限制为最多 160 个独立字素节点，超长歌词使用合并文字。背景 Three.js 保持按需加载；歌词核心已移除 GSAP 依赖，避免另一套自行推进的动画时钟。

## 验证与试听

点击首页「播放测试」，在手书、流光、拼贴、回响或字幕场景观察逐词进度。自制器乐的九句测试歌词均提供编排的词标签，每四秒起句，句尾留白 400ms；这些测试时间不是人声识别结果。拖到 24 秒仍显示「拖动进度，找到这一句」，在同一句内前后拖动可直接检查扫色恢复。

自动测试覆盖行/词解析、offset 与重复标签、Unicode 映射、时钟暂停和 Seek、隐藏恢复与卸载、短句预算、真实词高亮、动效求值一致性、离场节点清理。另增加了两类歌词数据回归：异步导入不覆盖另一首歌；原生队列播放只更新播放时间，保留后来更新的歌词、收藏等元数据。

浏览器 UI、原生音频设备及多屏壁纸仍需按 `docs/IMPLEMENTATION.md` 的实机验收项检查；单元测试和构建不代替这些验证。
