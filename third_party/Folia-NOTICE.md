# Folia lyrics port

`src/features/lyrics/folia/` contains code adapted from [Folia](https://github.com/chthollyphile/folia-major), commit `c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67`, provided locally in `D:\code\ck\folia-major`.

The upstream project identifies its author as chthollyphile and its license as AGPL-3.0. The complete license is retained in [Folia-LICENSE.txt](Folia-LICENSE.txt). These copied and adapted modules remain covered by that license; this is a source port, not an independent implementation. Distribution of the resulting combined application must satisfy the applicable AGPL terms.

Adaptations: isolated lyric-only types and imports, removed TTML debug output, formatted TypeScript for SOEI, and connected the algorithms to Vue through an explicit seconds/milliseconds adapter. The original parser and measurement algorithms use seconds internally. SOEI's public model, native playback state, offsets, component props and frame functions use milliseconds.

Modules: parserCore, ttmlConversion, renderHints, sentenceLayout, cjkSemanticLayout, wordSegmentation, graphemeTiming, formatDetection, alternateText, subtitleTrackStyle, monetLyricsModel, monetLyricMotion and wordColoring. Ported regression tests retain the same provenance. No upstream media, React components or application infrastructure is included.
