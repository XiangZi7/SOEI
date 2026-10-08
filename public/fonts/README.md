# SOEI 离线字体

这些字体通过 `src/styles/fonts.css` 的本地 `@font-face` 加载。Vite 构建时会复制整个字体目录，Tauri 使用应用内的资源；运行时无需互联网，无需在操作系统中安装字体。

| 用途 | 字体文件 | 字重 |
| --- | --- | --- |
| MUSIC、Purity、英文导航与歌曲信息 | CormorantGaramond-Variable.ttf | 300–700 |
| 英文斜体 | CormorantGaramond-Italic-Variable.ttf | 300–700 |
| 中文、日文与歌词 | NotoSerifSC-Variable.ttf | 200–900 |

下载来源为 [Google Fonts 官方仓库](https://github.com/google/fonts)：[Cormorant Garamond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond) 与 [Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc)。下载日期：2026-10-08。两者采用 SIL Open Font License 1.1，完整许可证保存在同目录。

参考图是位图，未提供源设计中的字体名称。这里依据字形选择接近的开源字体并调整字重、字号、字距和行距，不能把它们认定为已确认的原图字体。

使用完整中日文字库，避免仅裁剪页面现有文案而让离线导入的新歌词缺字。英文标题 300 字重，中日文歌词 300 字重，普通信息 400 字重；真实斜体使用独立文件，禁用浏览器合成字体。
