# SOEI · Music Space

基于 `项目任务书_v1.0.md` 和 `ui稿/` 实现的 Vue 3 / Tauri 2 本地音乐空间。当前为 **0.1.0 开发版**；完整 v1.0 的 Windows、多屏、媒体兼容和性能验收尚未完成，详见 [实施记录](docs/IMPLEMENTATION.md)。

## 运行

本次使用 Node 22.22.2、pnpm 10.33.0、Rust stable 1.96.0。原生构建需要 Windows MSVC C++ Build Tools 和 WebView2。依赖版本由 pnpm-lock.yaml 和 Cargo.lock 锁定。

```powershell
pnpm install --frozen-lockfile
pnpm dev                  # 浏览器预览；默认从 1420 开始，占用时依次尝试下一端口
pnpm tauri dev            # 原生窗口；自动选择可用端口并同步窗口地址
```

浏览器可导入本次会话的音频/LRC，设置保存到 localStorage。原生窗口使用 Rust 输出声音，SQLite 保存索引、收藏、设置、队列和播放列表。参考封面仅用于视觉预览，不附带歌曲，也不显示假播放进度。

### 一键播放测试

在画廊顶部点击 **播放测试**，自动播放《光的回声 · 播放测试》并进入歌词场景。附带 36 秒自制器乐旋律和 9 句同步测试歌词（无演唱），无需联网或选择文件。浏览器与 Tauri 桌面版都可使用。

- 每 4 秒显示下一句；暂停后进度与歌词停住，继续播放后同步前进。
- 拖动进度到 24 秒应显示「拖动进度，找到这一句」，拖回开头应显示「把声音交给此刻」。
- 浏览器导入时可同时选中音频及同名 `.lrc`，自动关联；在设置中单独导入的歌词也会按歌曲保留，切歌后恢复（限本次会话）。

测试素材位于 `public/demo/soei-test.wav` 和 `public/demo/soei-test.lrc`，可用 `node scripts/generate-playback-demo.mjs` 重新生成。桌面版点击测试时将内置素材保存到应用数据目录的 `playback-test/`，加入音乐库后通过原生音频输出播放。

## Tailwind 与组件库

- [主题变量](src/styles/tokens.css)：Tailwind v4 `@theme` 定义颜色、字体、字号、间距、圆角、阴影；运行时变量统一动效、层级和背景。
- [常用 class](src/styles/utilities.css)：`flex-center`、`flex-between`、`truncate-text`、`safe-page`、`touch-target` 和语义样式。
- [UI 组件接口](src/components/ui/README.md)：按钮、图标按钮、输入框、选择器、开关、滑块、面板、弹窗和徽标。业务页面已复用；`tailwind-merge` 处理样式覆盖。
- 在终端显示的实际地址后加 `/ui` 操作组件预览（默认 **http://localhost:1420/ui**）。

布局、颜色、字体、间距、响应式和控件状态优先使用 Tailwind。歌词错位排版、中心主封面几何与复合场景光效保留局部 CSS。

## 使用

1. 选择文件或目录导入。原生模式递归扫描、读取标签与内嵌封面，同名 LRC 自动关联；扫描可取消。
2. 搜索和分类浏览，收藏歌曲，点击本地歌曲开始播放。控制层提供进度、音量、队列和播放模式。
3. 设置中选择歌词排版、字号、毫秒同步偏移，或为当前歌曲导入 UTF-8 LRC。可选择图片与静音视频背景。
4. 场景内无操作约 3 秒后隐藏控制层，悬停、焦点或菜单开启时保持可见。`Esc` 返回，输入框外 `Space` 播放/暂停，`Ctrl+K` 搜索。
5. 原生窗口选择显示器后主动启用 WorkerW 壁纸。首次启动不会自动更改桌面。托盘、全局组合键、隐藏到托盘已接入，系统兼容情况见实施记录。

导入仅建立索引，不移动或删除原音乐。数据位于 Tauri `app_data_dir`：`soei.sqlite3` 与 `covers/`。备份前退出应用，并保留整个数据目录，包括可能存在的 SQLite WAL 文件。当前没有界面内数据库修复、缓存清理或失效文件重定位工具。

## 检查和构建

```powershell
pnpm check
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml native_output_seek_pause_resume -- --ignored
cargo fmt --manifest-path src-tauri/Cargo.toml --check
pnpm tauri build --no-bundle # Release 可执行文件
pnpm tauri build            # 安装包；需具备相应打包工具
```

设备测试以零音量的自制 WAV 验证原生输出、暂停和 Seek。`tests/fixtures/` 由 `scripts/generate-fixtures.mjs` 生成，不含第三方歌曲。

完成范围、验证证据和待验收项见 [实施记录](docs/IMPLEMENTATION.md)，素材来源见 [来源说明](docs/SOURCES.md)。
