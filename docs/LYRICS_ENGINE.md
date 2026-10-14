# 歌词引擎：时间轴与分镜

2026-10-12。按用户确认的「完整引擎及渲染模型、毫秒富模型、8 种格式、沿用 Folia 依赖」范围，从本地 `D:\code\ck\folia-major` 移植纯逻辑，保留 SOEI 原有播放时钟、字素安全校验和 Vue / Tauri 结构。

## 当前导入与解析

| 格式         | 导入形式                                       | 时间信息                                                 |
| ------------ | ---------------------------------------------- | -------------------------------------------------------- |
| LRC          | `.lrc`                                         | 行时间，重复标签、BOM、文件 offset                       |
| Enhanced-LRC | `.lrc`，角括号或行内方括号时间                 | 精确词时间、句尾时间标签                                 |
| VTT          | `.vtt`                                         | cue 开始/结束，移除 cue 标记                             |
| TTML         | `.ttml`                                        | 行、词、音节、ruby、翻译、罗马音、背景和声、演唱者及副歌 |
| YRC          | `.yrc`                                         | 绝对词时间与时长                                         |
| QRC          | `.qrc`，解密后的文本或 `LyricContent` XML 容器 | 绝对词时间与时长                                         |
| KRC          | `.krc`，明文或 `krc1` 二进制                   | 相对词时间、内嵌语言标签；XOR 解密及 zlib 解压           |
| AWLRC        | `.awlrc`                                       | LX 容器的行开始时间与相对词时间                          |

浏览器与 Tauri 的歌词选择器均接受以上文件。同名 sidecar 自动关联；原生端保留原来的 LRC 优先级并支持大写扩展名。原生 IPC 传递 `{ name, bytes }`，不提前将 KRC 或旧编码文件转成 UTF-8。前端共享 UTF-8、UTF-16 BOM 和 GB18030/GBK 解码；原始文件与 KRC 解压结果均限制为 2 MB。QRC 的在线 provider 加密数据和在线歌词抓取不属于本地文件导入接口。

`parser.ts` 负责格式检测和公开解析接口；`lrc.ts` 保留原有严格时间验证。合并在一个 LRC 时间轴内的字幕可拆成原文、翻译和罗马音，外部显式字幕优先；字幕采用最近的一对一匹配。间奏通过 `includeInterludes` 显式启用，默认关闭。TTML 会为缺少 Apple key 的标准行补充唯一标识，并兼容 TTML 元素的命名空间前缀。

## 富模型与时间边界

`types/music.ts` 中的 `LyricDocument`、`LyricLine`、`LyricWord`、`LyricSyllable`、`LyricRuby` 和 `LyricBackgroundVocal` 均使用 `startMs/endMs`。动效提示使用 `rawDurationMs/renderEndMs`。模型保留 alternateTexts 的语言、声部、songPart、blockIndex、isChorus 以及可选的 wordSegments。

隔离在 `features/lyrics/folia/` 的原算法仍使用秒，`adapter.ts` 是唯一的数据模型转换边界；组件 props、播放状态和歌词偏移统一使用毫秒。转换发生在解析或布局编译阶段，不在每帧转换整首歌词。AMLL 自带的毫秒音节时间先经过上游转换，再由边界适配器恢复 SOEI 的毫秒模型，回归测试验证嵌套 ruby 和和声没有单位漂移。

普通 LRC、VTT 和行级 TTML 不会暴露解析器生成的估计词时间。混合普通/逐词歌词时，每一行独立标记 `timing`，只有真实的词时间参与演唱高亮。`glyphTiming.ts` 保留原有 Unicode 与标点校验，并优先使用 TTML 音节边界。

## Vue 渲染接入

- `renderModel.ts`：将 Monet 的显示 token、测量字宽、扫光边缘与发光包络适配为毫秒接口；时间数组在 token 编译时缓存。
- `LyricRail.vue`：叙事模式的等待/活动/已完成行窗口；布局测量缓存最多 240 项，字体完成加载时失效。行的真实 DOM 尺寸只在内容、容器或字体改变时读取。活动长行按容器缩放以保留全文。
- `TimedLyricText.vue` 与 `useLyricSweep.ts`：显示完整文本及 ruby；播放时只更新扫光、发光和词状态。暂停与 Seek 直接求当前位置，组件销毁后不再写入节点。
- `LyricAnnotations.vue`：活动行的罗马音、翻译、演唱者、副歌和独立时间轴和声。
- `layout.ts`、`lyricStoryboard.ts` 与 `KineticLyrics.vue`：接入多层句子断行、CJK 语义单元和粘连标点。边界必须符合原始词/语义单元与完整字素；多字注音合成一个显示单元，文字连接后仍等于原文。
- `lyricMotion.ts`：在原有阅读预算内应用 normal/short/micro 动效提示。暂停在句首重新进入或切换构图时完整显示文字，仍按真实时间显示词进度。

叙事模式支持鼠标滚动及上下方向键浏览，停止操作 1.8 秒后回到当前歌词；点击任意歌词行定位媒体时间，扣除全局及歌曲专属偏移。减少动态效果时停止位移/发光，保留词进度。

## 移植来源与许可

实际移植的 Folia 版本为 `c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67`。解析、排版、动效提示及 Monet 纯模型保留 AGPL-3.0 来源；AMLL TTML 依赖为 AGPL-3.0-only，xmldom/pretext/fflate 为 MIT。具体文件与完整许可见 [移植声明](../third_party/Folia-NOTICE.md)、[Folia 许可证](../third_party/Folia-LICENSE.txt) 和 [来源说明](SOURCES.md)。此次没有复制 React UI 或媒体素材。

## 验证

新增格式/富模型/解码/扫光测试，并移植 Folia 的解析、CJK、断句、字素、分词和双字幕测量回归。原有播放时钟、暂停、Seek、异步换歌和歌词导入竞争测试继续保留。Rust 覆盖大小写 sidecar、优先级及二进制歌词无损传输。

浏览器通过现有导入入口载入 `tests/fixtures/rich-lyrics.ttml`，已观察叙事与手书场景中的注音、双字幕、和声和副歌；歌词行点击定位、暂停句首重入和控制台错误检查均已验证。自制测试音频不含人声，测试歌词时间为编排结果。Windows 音频设备测试与多屏壁纸仍按 [实施记录](IMPLEMENTATION.md) 的实机验收项处理。

## 此前时间轴的源码参考（2026-10-09）

| 参考                                              | 实际阅读的源码                                                                                                                                                                                                                                                                                                                         | SOEI 的实现                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Folia `c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67`  | [temperaMotion.ts](https://github.com/chthollyphile/folia-major/blob/c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67/src/components/visualizer/tempera/temperaMotion.ts)、[temperaProgram.ts](https://github.com/chthollyphile/folia-major/blob/c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67/src/components/visualizer/tempera/temperaProgram.ts) | 由绝对播放时间计算动效；词时间与入场、停留、退场时间分离，Seek 无需重演历史帧                                           |
| Folia 字素时间模型                                | [graphemeTiming.ts](https://github.com/chthollyphile/folia-major/blob/c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67/src/utils/lyrics/graphemeTiming.ts)                                                                                                                                                                                     | 保留 Enhanced LRC 词边界，词内以完整字素均分，保护组合音标和 ZWJ emoji；未标时标点不独占演唱区间                        |
| JIZURA `fc16bfe43ea4a6c25a21f1caf04d17326de14f00` | [05_anim.js](https://github.com/852wa/JIZURA/blob/fc16bfe43ea4a6c25a21f1caf04d17326de14f00/src/05_anim.js)、[05b_registry.js](https://github.com/852wa/JIZURA/blob/fc16bfe43ea4a6c25a21f1caf04d17326de14f00/src/05b_registry.js)                                                                                                       | 布局与动效解耦，提供轻移、遮罩、轻缩放、抬升四种克制组合，镜头持留采用两端归零的包络                                    |
| JIZURA 规划与渲染                                 | [08_planner.js](https://github.com/852wa/JIZURA/blob/fc16bfe43ea4a6c25a21f1caf04d17326de14f00/src/08_planner.js)、[09_render.js](https://github.com/852wa/JIZURA/blob/fc16bfe43ea4a6c25a21f1caf04d17326de14f00/src/09_render.js)                                                                                                       | 按句子时长和文本长度限制动效；预先规划，再按局部播放时间求值。SOEI 使用更长的阅读预算，不采用上游估算节拍覆盖真实词时间 |

2026-10-09 的独立时间轴实现未复制 Folia 或 JIZURA 源码。2026-10-12 的本次移植已实际复制并适配 Folia 的纯模块；JIZURA 仍为算法与构图参考，未复制源码或素材。

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

## 2026-10-14 Folia 渲染层续作

从 Claude 会话 `7e7123f0-b1f7-4143-bacd-859e9b908470` 的 `classic` 中断处继续。此前已完成共享运行时、Pixi 宿主和「静止」注册；本轮完成「辉光（classic）」Vue 场景、共用字幕、调参面板和异步注册，场景总数为 9。

- `classicLayout.ts` 保留上游的确定性松散词布局、词距测量与行时序档案；增加 SOEI 场景种子与持久化参数校验。
- `classicFrame.ts` 预先准备分词、字素时间与光晕，再按绝对秒数计算等待、演唱与唱过状态。短句即时显示；普通 LRC、估算词和无法对齐的词片段保留完整正文，不显示演唱辉光。
- `ClassicLine.vue` 只在行、字体、舞台尺寸、主题或调参变化时重建布局，帧循环直接写当前节点样式。平衡/高质量分别限制为 30/60 帧；暂停、隐藏、省电和减少动态效果停止持续循环。暂停时 Seek 通过时间通知直接重绘。
- `VisualizerSubtitleOverlay.vue` 复用 Folia 的译文/罗马音轨道规则，过滤分隔符，间隙可保留上一句字幕，无译文时预览后两句。
- 修复原桥接层的缓存漏洞：宿主每次构造输入快照会使整首歌词随位置更新而重新转换。新增回归先复现失败，再用独立 computed 隔离歌词数组与时长；转换结果保持稳定。

本轮通过前端 38 个测试文件、408 项测试、类型检查、ESLint、Prettier 与生产构建。辉光 renderer 与设置面板均独立异步分块。一次格式检查遇到 Node 内存不足，降低单进程堆预算后单独重跑通过。

浏览器使用自制测试音频完成实际播放、暂停、2.5 → 3.1 → 2.5 秒同句回拖、24.5 秒跨句定位、减少动态效果、换分镜保留进度、参数修改后重载保存，以及 600×720 排版检查；控制台无警告或错误。原生音频、多屏壁纸和安装包本轮未重跑。

本次完成的是 Claude 中断的 classic 批次；Folia 全部模式迁移尚未完成。批次 A 的 tilt、partita、claddagh、cadenza，以及后续 Pixi 模式仍待接入。来源与改编差异见 [Folia-NOTICE.md](../third_party/Folia-NOTICE.md)。
