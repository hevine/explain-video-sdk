# @waiyu/explain-video

**解题答疑视频 SDK** —— 把大模型生成的精读讲解（语法、音频、考点提示与解析）变成浏览器里的「AI 教授」：
结构化的 **Div 分镜** 随音频时间轴播放，支持 **seek / 倍速 / 字幕跟随**，逐字稿每一句都 **可编辑并实时同步** 到播放画面。

- **零耦合**：SDK 只负责「协议 + 时间轴 + 渲染 + 编辑」，不请求网络、不读 localStorage、不碰宿主 store。LLM、TTS、存储由宿主（外语考证宝典主项目）负责。
- **独立代码库**：本目录是独立 git 仓库；核心入口框架无关，`react` 绑定为可选 peer 依赖。
- **轻量**：核心无运行时依赖；React 播放器 `dist/react.js` 约 21 kB（gzip 6 kB）。

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5190 独立 demo（自带静音音轨，无需主项目）
npm test           # 16 个时间轴/协议单测
npm run build      # 产出 dist/（含 .d.ts 与 styles.css）
```

在宿主项目中：

```tsx
import { ExplainVideoPlayer } from '@waiyu/explain-video/react';
import '@waiyu/explain-video/styles.css';

<ExplainVideoPlayer
  video={video}                       // ExplainVideo 协议对象
  context={{ body, translation }}     // 可选：passage 镜高亮原文
  onRequestPlay={() => claimMediaPlayback('explain')}
  onTranscriptChange={(event) => api.explainSaveTranscript(video.id, event.video)}
  audioUrlResolver={(url) => fetchBlobUrl(url)}  // 可选：鉴权音频转 blob URL
/>
```

## 协议（核心概念）

```
ExplainVideo
├─ shots[]    分镜：cover / question / passage / grammar / eliminate / answer / point / takeaway
│            每镜带 audio:{ url, durationMs }、narration、caption、highlight
└─ cues[]     逐字稿：{ id, shotId, startMs, endMs, text, zhText? }
```

- `computeTimeline(video)` 由每段音频时长推导 `shotRanges / cueRanges / totalMs`；
- `cueAt(ms)` / `shotIndexAt(ms)` 用于 seek 后定位当前句与当前镜；
- `applyTranscriptEdit(video, event)` 生成新的不可变 video 对象，编辑后立即反映到分镜与字幕；
- `validateVideo(video)` 校验答案索引、音频时长、cue 边界；
- `buildExportManifest(video)` 输出给宿主的 ffmpeg 合成清单（本 SDK 不负责合成 mp4）。

完整类型见 `src/types.ts`，工具函数见 `src/timeline.ts`。

## 目录

| 路径 | 说明 |
| --- | --- |
| `src/types.ts` / `src/timeline.ts` | 框架无关协议与时间轴纯函数 |
| `src/react/ExplainVideoPlayer.tsx` | 主播放器：rAF 时间轴、seek、倍速、字幕、控制条、编辑面板 |
| `src/react/shots/*` | 8 类 Div 分镜渲染器 |
| `src/react/TranscriptEditor.tsx` | 逐句编辑，实时同步 |
| `src/react/Coordinator.ts` | 与宿主播放器互斥的播放权协议 |
| `src/styles.css` | 自包含样式，CSS 变量可主题化 |
| `demo/` | 独立可运行 demo |
| `test/timeline.test.ts` | 16 个协议/时间轴测试 |

## 与外语考证宝典的集成

主项目路径：`/Users/zhua/WorkBuddy/2026-11-04-12-41-53/waiyu-baodian`，通过 `file:` 依赖本目录。
入口位于各语言「精读」任务右栏（`ExplainVideoPanel`），生成链路为：

```
POST /api/explain-videos  → LLM 生成分镜脚本（目标语旁白 + 中文字幕，答案以题库为准）
                          → edge-tts 分段配音 + WordBoundary 时间轴
                          → 落盘 .data/explain-video/local/<articleId>/
GET  /api/explain-videos/:id        → ExplainVideo 协议对象
GET  /api/explain-videos/:id/seg/N   → 分段音频（带鉴权）
PUT  /api/explain-videos/:id/transcript → 保存编辑后的逐字稿
POST /api/explain-videos/:id/export     → ffmpeg 合成 mp4（npm 静态 ffmpeg 优先）
```
