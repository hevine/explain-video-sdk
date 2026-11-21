# 解题答疑视频 SDK · 说明逐字稿

> 这份稿子按「可以顺着读一遍、也可以照着讲给别人听」的方式写。
> 每一幕是一个独立主题，念完一幕可以停下来对着代码或 demo 看一遍。
> 读完你应该能回答三个问题：**它靠什么跑起来 / 宿主怎么接 / 下一步该往哪走。**

---

## 使用说明

- 全稿约 25 分钟读完；带「⏸ 停一下」的地方建议真的停下来打开 demo 点两下。
- 代码片段都是仓库里真实存在的文件，路径相对 `explain-video-sdk/`。
- 配套文档：`README.md`（速查）、`RUNBOOK.md`（怎么跑）、`ITERATION.md`（迭代清单）。

---

## 第一幕 · 一句话说清它是什么

解题答疑视频 SDK 做的事情，一句话：

> **把大模型写出来的「讲解稿 + 配音」，在浏览器里还原成一堂可以拖进度条、可以改稿的课。**

它不是播放器插件，也不是视频生成工具。它是一套**协议 + 时间轴 + 渲染 + 编辑**的组合：

- 后端给什么？一串「分镜」（shot），每个分镜带一句旁白、一段音频、一组要高亮的内容。
- SDK 做什么？把这些分镜按音频时长排成一条时间轴，随着音频播放一镜一镜地用 **Div** 画出来，同时同步字幕。
- 用户能做什么？拖进度条跳到任意位置、调倍速、点某一句跳到那一句、**直接改逐字稿的每一句**，改完立刻在画面上生效。

所以它的定位一句话概括就是：**音频是时钟，Div 是画面，协议是接口。**

---

## 第二幕 · 为什么不用视频？三个关键判断

这是整个 SDK 最重要的设计选择，值得先讲清楚。

### 判断一：用「音频时间轴」而不是「视频时间轴」

如果真去渲染 mp4，你会立刻遇到三个成本：服务端要 ffmpeg、每次改稿要重新编码、seek 要么不准要么很卡。

而讲解这件事，本质是**一个人在说话**。说话的天然时钟就是音频。于是我们只合成音频（edge-tts，一镜一段 mp3），画面完全由前端按时间画。

带来的好处是连锁的：

- 改稿不需要重新编码，只需要改一个字符串；
- seek 只是把 `<audio>` 的 `currentTime` 挪一下，毫秒级；
- 没有视频文件，带宽只有音频那么大（一镜几十 KB）。

### 判断二：画面用 Div，不用 Canvas 或图片

讲解内容是**结构化的文本**：题干、选项、原文句子、语法结构、考点标签。这些用 DOM 渲染，天生带来四个能力：

1. 可以选中、复制（用户想抄走一个语法点）；
2. 可以被 CSS 主题化（宿主一套变量就换肤）；
3. 可以被无障碍读屏；
4. 可以**局部高亮**（把原句里的某几个词染色，Canvas 得自己算排版）。

代价是「炫酷动效」有限。但对「学会一道题」这个目标，清晰 > 炫酷。

### 判断三：协议与实现分离

`src/types.ts` + `src/timeline.ts` 是**纯 TypeScript，零 React、零 DOM、零网络**。这意味着：

- 后端可以用同一套语义生成 JSON（主项目 `server/src/domain/explainVideo.ts` 就是它的结构镜像）；
- 单测可以在 Node 里跑，不需要浏览器；
- 将来要出 Vue / Web Component 版本，只换渲染层，协议不动。

⏸ **停一下**：打开 `src/index.ts`，注意它只导出「类型 + 纯函数」；UI 在 `@waiyu/explain-video/react` 子路径。这个切分不是洁癖，是为了让 SDK 能在没有 React 的环境里被消费。

---

## 第三幕 · 架构：四层，一条单向数据流

从下往上四层：

```
┌──────────────────────────────────────────────────────────┐
│ ④ 宿主适配层（主项目，不在 SDK 里）                        │
│   ExplainVideoPanel：四态 UI / 缓存预检 / 进度 / 导出      │
├──────────────────────────────────────────────────────────┤
│ ③ React 渲染层（@waiyu/explain-video/react）              │
│   ExplainVideoPlayer · ShotStage · 8 类 Shot · Transcript │
│   Editor · useTimeline · Coordinator                      │
├──────────────────────────────────────────────────────────┤
│ ② 时间轴内核（纯函数）                                     │
│   computeTimeline · cueAt · shotIndexAt · applyTranscript │
│   Edit · validateVideo · buildExportManifest               │
├──────────────────────────────────────────────────────────┤
│ ① 协议层（src/types.ts）                                   │
│   ExplainVideo · Shot · Cue · ShotHighlight · GrammarFocus │
└──────────────────────────────────────────────────────────┘
```

数据流是**单向**的：

```
宿主传入 video(JSON)
   → computeTimeline 推出 ranges / cues
   → <audio> 播放第 n 段
   → rAF 把 audio.currentTime 换算成整片 ms
   → cueAt / shotIndexAt 定位当前句与当前镜
   → 渲染对应 Shot + 高亮字幕
   → 用户编辑某句 → applyTranscriptEdit 生成新 video（时间轴不变）
   → onTranscriptChange 回调宿主保存
```

注意最后一步：**SDK 不回写自己以外的任何地方**。它不 fetch、不读 localStorage、不碰宿主的 store。所有「外部世界」的交互都通过 props 回调出去。这条边界让 SDK 可以在 demo 里脱离主项目独立跑，也让宿主随时能换成自己的存储。

---

## 第四幕 · 协议详解：三个对象说完整件事

### 4.1 `ExplainVideo` —— 一部片子

```ts
interface ExplainVideo {
  id: string;
  articleId: string;          // 绑定哪篇文章，换文章 id 就变
  language: 'en' | 'ja' | 'ko';
  narrationLanguage: 'target' | 'zh';   // 旁白语言：目标语 or 中文
  voice: string;              // zh-CN-XiaoxiaoNeural 之类
  title: string;
  totalMs: number;            // 整片时长（由分镜累加推导）
  shots: Shot[];              // 画面
  cues: Cue[];                // 逐字稿（句级）
  createdAt: string;
}
```

一个容易被忽略的点：**`totalMs` 不是配置，是推导结果**。它等于所有 `shot.audio.durationMs` 之和。所以任何一段音频变了，整片时长自动跟着变，不需要手工同步。

### 4.2 `Shot` —— 一个分镜

```ts
interface Shot {
  id: string;                  // s0, s1… 编辑锚点
  kind: ShotKind;              // cover|question|passage|grammar|eliminate|answer|point|takeaway
  narration: string;           // 旁白原文（喂给 TTS 的文本，也是可编辑对象）
  caption: string;             // 屏幕字幕（中文，通常比旁白短）
  questionNo?: number;         // 属于第几题
  prompt?: string;             // 题干快照
  options?: string[];          // 选项快照
  highlight?: ShotHighlight;   // 高亮指令
  grammar?: GrammarFocus;      // 语法镜载荷
  point?: ExamPoint;           // 考点镜载荷
  audio: { url: string; durationMs: number };
}
```

两个设计细节值得说：

**① 题干/选项是「快照」而不是「引用」。**
分镜里直接带 `prompt` 和 `options`，不去宿主那里按 `questionNo` 查表。这样 SDK 渲染一个分镜是**自足的**——离线、换题库、题目被编辑过，都不会画错。

**② `highlight` 是「指令」而不是「结果」。**

```ts
interface ShotHighlight {
  paragraph?: number;   // 第几段
  sentence?: string;    // 要高亮哪句（精确匹配，匹配失败退化为段号）
  options?: number[];   // 高亮哪些选项
  picked?: number;      // 被选中/被排除的那一项
}
```

SDK 只负责「把第几项标红」，**不负责判断它对不对**。答案由宿主的题库权威给出。这是刻意的权限划分：渲染层不做业务判定。

### 4.3 `Cue` —— 一句字幕

```ts
interface Cue {
  id: string;          // s3-c1（第 3 镜第 1 句）
  shotIndex: number;
  text: string;        // 屏幕字幕
  narration: string;   // 可编辑旁白
  startMs: number;     // 绝对时间（相对整片）
  endMs: number;
  edited?: boolean;    // 改过就标一下
}
```

`Cue` 是「逐字稿可编辑」的落点。一镜可以有多句，句是编辑与高亮的最小单位。

---

## 第五幕 · 时间轴是怎么算出来的

核心函数只有一个：

```ts
computeTimeline(shots, language, boundariesByShot?) → { ranges, totalMs, cues }
```

### 5.1 分镜级：累加

```ts
let cursor = 0;
shots.forEach((shot, i) => {
  const dur = Math.max(0, Math.round(shot.audio.durationMs));
  ranges.push({ shotIndex: i, startMs: cursor, endMs: cursor + dur });
  cursor += dur;
});
```

就这么简单。**精确度全部押在 `durationMs` 上**，而它是后端 edge-tts 的 `SentenceBoundary` 真值，不是估的。

### 5.2 句级：两条路径

- **精确路径**：后端把每个 `SentenceBoundary`（文本 + 相对偏移 + 时长）传进来，SDK 直接加上镜起点，得到绝对时间。
- **兜底路径**（没有边界时）：把旁白按标点切句，然后**按字符长度比例**分配这一镜的时长，最后一句吸收取整误差。

```ts
const len = isLast ? endMs - localCursor
                   : Math.max(1, Math.round(duration * weights[i] / total));
```

兜底路径不完美（语速不是均匀的），但它保证了「任何一份手写 JSON 都能播」——demo 就完全跑在这条路径上。

### 5.3 查询：二分

播放时每帧都要问两件事：「现在第几镜？」「现在第几句？」

```ts
cueAt(cues, ms)          // 二分找最后一个 startMs <= ms 的 cue
shotIndexAt(ranges, ms)  // 二分找覆盖 ms 的 range
```

用二分而不是 `find`，是因为一部长片可能有几百句，每帧线性扫会掉帧。几百句时这不算瓶颈，但这个 O(log n) 让「字幕跟随」在低端机上也不抖。

一个体验细节：`cueAt` 在句子间隙返回**上一句**，而不是 null。视觉上字幕会一直停留到下一句出现，屏幕不会闪空。

---

## 第六幕 · 播放器内核：一个 `<audio>` 播 N 段音频

这是整个 SDK 最需要解释的机制。

### 6.1 为什么只有一个 audio 元素

一镜一段 mp3，直觉做法是 N 个 `<audio>`。但那会带来同步问题：切镜时两个元素重叠、音量叠加、seek 要同时管 N 个状态。

实际实现是**一个** `<audio>`，每换一镜就换 `src`：

```ts
// 简化后的 seek 流程
async function seek(ms) {
  const target = clampMs(ms, totalMs);
  const idx = shotIndexAt(ranges, target);
  const offsetInShot = target - ranges[idx].startMs;
  await loadInto(idx, offsetInShot, false);   // 换 src，等 loadedmetadata，再设 currentTime
  publish(target);                            // 通知 UI
}
```

三步必须按顺序：**先切音频、等元数据、再设偏移**。顺序错了 `currentTime` 会被重置成 0，表现就是「拖了进度条却从头播」。

### 6.2 rAF 把 `currentTime` 换算成整片毫秒

```ts
const ms = ranges[idx].startMs + audio.currentTime * 1000;
```

每帧读一次，交给 React state。这里有两个工程细节：

1. **所有宿主回调走 ref**。rAF 的回调闭包会捕获旧 props，如果直接读 `onShotChange` 就会调到上一版函数。用 `optionsRef.current` 包一层即可。
2. **`ended` 事件兜底**。部分浏览器在最后一帧 rAF 里跨镜判定会漏，音频已经播完但时间没推进。于是额外监听 `ended`，主动进下一镜；最后一镜则 `publish(totalMs)` 并触发 `onEnded`。

### 6.3 倍速不影响时间轴

```ts
audio.playbackRate = rate;   // 0.75 / 1 / 1.25 / 1.5 / 2
```

因为时间轴是从 `audio.currentTime` 反推的，`playbackRate` 变了，`currentTime` 的增长速度自然跟着变，画面与字幕自动对齐。**不需要任何额外补偿**——这是「音频当时钟」这个选择的又一次红利。

⏸ **停一下**：`npm run dev`，在 demo 里把倍速切到 2x，观察字幕是不是仍然对齐。再拖一次进度条，注意它有没有从头开始。

---

## 第七幕 · 八类分镜：每种镜在讲什么

| kind | 教学作用 | 关键载荷 |
| --- | --- | --- |
| `cover` | 开场：这节课解决什么 | 标题、题数 |
| `question` | 呈现题干与选项 | `prompt` / `options` |
| `passage` | 回到原文，定位证据句 | `highlight.paragraph` / `.sentence` |
| `grammar` | 拆长难句 | `grammar.{sentence,structure,explanation}` |
| `eliminate` | 逐项排除错项 | `highlight.picked` + 错因 |
| `answer` | 给出答案与理由 | `highlight.picked`（必填） |
| `point` | 考点提示 | `point.{label,text}` |
| `takeaway` | 收尾总结 | 三句话回顾 |

每类都是独立组件（`src/react/shots/*.tsx`），共用 `ShotProps`：

```ts
interface ShotProps {
  shot: Shot;                 // 本镜全部载荷（题干/选项/高亮/语法/考点）
  video: ExplainVideo;        // 整片，个别镜需要读同题其他镜做对照
  context?: ExplainContext;   // 宿主传的 body / translation / questions
  step?: number;              // 「讲解深潜」子步骤，用于逐项动画（0 基）
}

interface ExplainContext {
  body?: string;              // passage 镜精确匹配原句用
  translation?: string;
  questions?: QuestionLike[];
}
```

`ShotStage` 是一个纯 `switch` 分发器：根据 `shot.kind` 选渲染器，未识别的 kind 降级成一行 caption（保证协议演进时旧播放器不崩）。想加一种新镜（比如 v0.2 的 `quiz`），只需：加一个 kind、加一个组件、在 `ShotStage` 里注册一行。**协议、时间轴、播放器都不用改。**

这就是为什么迭代清单里那些新能力（互动暂停、micro-drill、总结清单）能以「分镜载荷 + 宿主回调」的方式扩展，而不需要重写播放器。

---

## 第八幕 · 逐字稿编辑：为什么改字不会让音画错位

这是这套设计里最优雅的一点，值得慢慢说。

### 8.1 编辑只改文本，绝不改时间戳

```ts
applyTranscriptEdit(video, cueId, field, value):
  cues[cueId][field] = value
  cues[cueId].edited = true
  return { ...video, cues, updatedAt: now }   // 时间轴字段一个没动
```

为什么不重算？因为**重算会让画面跳**。用户正在看第 12 句，改了一下第 3 句的文字，如果时间戳跟着重排，画面会突然跳到别处。

所以：**文本和时间轴解耦**。改字只影响屏幕上显示什么，不影响「什么时候显示」。

代价是：改稿后音频还是老的（说的是旧词）。这个代价是 knowingly 接受的，解决方案在下一版——**局部重新配音**（`onNarrationEdit(shotId, text)`，宿主只重合成那一镜）。

### 8.2 实时同步的含义

「实时同步」在这个 SDK 里指两件事，都不涉及网络：

1. **同屏即时**：`applyTranscriptEdit` 返回的新 video 立刻进入组件 state，字幕、分镜高亮、逐字稿列表同时更新。不需要保存、不需要刷新。
2. **回调持久化**：每次编辑触发 `onTranscriptChange(event)`，`event.video` 是**完整可用**的新对象，宿主直接 `PUT /transcript` 即可。

```tsx
onTranscriptChange={(event) => api.explainSaveTranscript(event.video.id, event.video)}
```

如果将来要做「老师改稿、学生实时看到」，走的也是这个回调——把它接到 WebSocket 广播即可，**SDK 不用改一行**。传输是宿主的责任，SDK 保持传输无关。

---

## 第九幕 · 播放权：为什么需要一个小协调器

页面上可能同时存在：精读朗读（Web Speech）、听力播放器、讲解视频。三个一起响就是灾难。

SDK 内部有个极简 registry（`src/react/Coordinator.ts`）：

```ts
registerPlayer(id, { stop })   // 播放器注册自己
claimPlayback(selfId)          // 抢播放权：停掉其他所有实例
releasePlayback(selfId)        // 释放
```

它解决**同屏多个 ExplainVideoPlayer 互斥**。但宿主还有别的播放器，所以留了一个注入点：

```tsx
<ExplainVideoPlayer
  onRequestPlay={() => {
    claimMediaPlayback('explain');                     // 宿主全局协调器
    window.speechSynthesis?.cancel();                   // 顺手掐掉朗读 TTS
  }}
/>
```

为什么 `speechSynthesis.cancel()` 要单独调？因为 Web Speech 不走 `<audio>`，宿主的 mediaCoordinator 管不到它。这是集成时最容易漏的一行，漏了就会出现「两个人的声音叠在一起」。

---

## 第十幕 · 宿主那一半：生成链路

SDK 只解决「播」，内容从哪来是宿主的事。主项目的链路是四段：

```
POST /explain-videos
  ├─ script   LLM 一次生成全部分镜脚本（目标语旁白 + 中文字幕）
  ├─ speech   逐镜 edge-tts 配音（并发 2，失败重试 1 次，单镜失败降级静音）
  ├─ assemble 累加时长 + 句边界 → cues，写 manifest.json + seg-N.mp3
  └─ done     回填 token 用量与 cacheHit
```

### 10.1 脚本阶段：三条硬约束

`server/src/services/explainScript.ts` 里，prompt 不只是「请生成讲解」，而是钉死了三件事：

1. **答案以题库为准**。模型只允许解释，不允许改答案；返回后代码层再交叉校验一次 `picked` 是否等于 `question.answer`。
2. **旁白用目标语、字幕用中文**。语言分离，保证听力输入是目标语，理解成本是中文。
3. **每镜必须有可定位的证据**。`passage` 镜要给出能在正文里精确匹配到的原句，否则渲染降级为段号。

这是「AI 讲错题」的防线。答疑类产品，讲错一次就失去信任。

### 10.2 配音阶段：为什么一镜一段

- 一镜一段，任何一镜重配不影响别的镜（v0.4 局部重配音的基础）；
- 并发合成，4 题 22 镜约 20~40 秒；
- 单镜失败不炸整片——合成静音 + 保留字幕，用户仍能读。

### 10.3 缓存：省 token 的关键

```
hash(articleId | voice | rate | scriptVersion | 题目文本 | 正文 | 译文)
```

- 进页签先 `GET /resolve`：命中就直接读盘，**不建 job、不调 LLM、零 token**；
- 没命中才 `POST` 建 job；
- 前端在 idle/loading 都明确告知「预计消耗 X–Y token」「命中缓存 0 token」。

实测：4 题 22 镜一次约 **7.3k token**；二次打开 `cacheHit=true, tokens=0`。

### 10.4 导出：SDK 只出清单，宿主出 mp4

`buildExportManifest(video)` 产出「每镜的起止时间 + 要画的文本行 + 音频 URL 顺序」，宿主用 ffmpeg 拼。SDK 完全不碰编码。

这个分工的好处：浏览器能播 ≠ 一定要能导出。导出是增值能力，坏了不影响主链路。

---

## 第十一幕 · 对接五步（照着做）

### 第 1 步：装依赖与样式

```bash
npm install file:../explain-video-sdk      # 或 tarball / registry
```

```tsx
// 全局入口引一次
import '@waiyu/explain-video/styles.css';
```

### 第 2 步：把后端数据映射成 `ExplainVideo`

宿主的数据结构不必和 SDK 一致，写一个 mapper 即可：

```ts
function toExplainVideo(serverVideo: ServerVideo): ExplainVideo {
  return {
    ...serverVideo,
    shots: normalizeShots(serverVideo.shots),   // 补 id、清洗 durationMs
  };
}
```

### 第 3 步：算出时间轴（可选）

如果后端已经给了 `totalMs` 和 `cues`，直接用；否则：

```ts
const video = withTimeline(rawVideo, boundariesByShot);
```

### 第 4 步：挂播放器

```tsx
<ExplainVideoPlayer
  video={video}
  context={{ body: article.body, translation: article.translation, questions: article.questions }}
  theme={{ accent: '#4f7cff' }}
  editable
  transcriptOpen
  audioUrlResolver={(url) => fetchBlobUrl(url)}       // 鉴权音频转 blob
  onRequestPlay={() => claimMediaPlayback('explain')}
  onTranscriptChange={(e) => save(e.video)}
  onShotChange={(i) => console.log('现在第', i, '镜')}
  ref={playerRef}
/>
```

`audioUrlResolver` 的存在是为了让鉴权留在宿主：SDK 只拿到一个「可以直接喂给 `<audio>.src` 的地址」。

### 第 5 步：需要程序化控制时用 ref

```ts
playerRef.current?.seek(35_000);      // 跳到 35 秒
playerRef.current?.seekShot(6);       // 跳到第 6 镜
playerRef.current?.setRate(1.5);
playerRef.current?.getCurrentMs();
```

---

## 第十二幕 · 边界：它刻意不做什么

这一节很重要，因为它决定了这个 SDK 能不能长期活下去。

| 不做 | 为什么 | 谁来做 |
| --- | --- | --- |
| 不发网络请求 | 一旦联网就要处理鉴权、重试、缓存，SDK 会变成半个后端 | 宿主（`audioUrlResolver`） |
| 不判断答案对错 | 渲染层做业务判定，迟早和题库打架 | 宿主 + 代码校验 |
| 不存任何状态到磁盘 | 换设备、多端、隐私都变复杂 | 宿主（`onTranscriptChange`） |
| 不做 mp4 编码 | 编码是重活，且不是播放的必要条件 | 宿主（ffmpeg） |
| 不内置播放列表/推荐 | 那是产品逻辑 | 宿主 |

一句话：**SDK 负责「把一份讲解正确地演出来」，其余全是宿主的事。**

---

## 第十三幕 · 已经踩过的坑（讲给别人听最有用）

1. **`drawtext` 内联文本会被逗号/引号破坏**。ffmpeg 的滤镜表达式解析器把 `,` 当分隔符，旁白里一个逗号就能让整条命令失败。解法：改写临时文件，用 `textfile=` 引用。
2. **总超时会误杀配音阶段**。LLM 慢的时候脚本就吃掉 3 分钟，剩 1 分钟不够配音。解法：分阶段计时（脚本 5 分钟 / 配音+组装 4 分钟）。
3. **`brew install ffmpeg` 会卡在网络**。解法：改用 `@ffmpeg-installer/ffmpeg` 静态二进制，`npm install` 就能拿到。
4. **宿主读的是 `dist/`，不是 `src/`**。改完 SDK 忘了 build，页面就是老行为——这是最高频的「改了没生效」。
5. **缓存 key 不含正文会误命中**。同一篇 id 换了文章内容，旧讲解会被当成新的。解法：hash 纳入 `body + translation`，并引入 `SCRIPT_VERSION`。
6. **动画的进度条不是装饰**。生成要 1~3 分钟，没有阶段反馈用户会以为卡死。所以有了手绘分镜动画 + 阶段文案 + 时长/token 预估。

---

## 第十四幕 · 后续迭代方向

完整清单在 `ITERATION.md`，这里讲**判断逻辑**而不只是罗列。

### 核心命题：从「讲一遍」到「学会」

MVP 的内容密度偏薄——4 题 22 镜，本质是「把题讲了一遍」。真正帮到用户需要三段闭环：

```
teach（讲清楚） → practice（自己试） → recall（记住）
```

对应到能力上：

**v0.2 · 教学闭环（最高优先级）**
- **互动暂停点**：新 kind `quiz`，在排除前停住问「你会选哪个」，点了才继续。把被动听变成主动答。
- **逐项排除拆镜**：现在一镜讲完所有错项，改成「一个错项一镜 + 错因标签」（偷换概念/无中生有/张冠李戴/反向）。
- **分层讲解**：`depth: brief | standard | deep`，先给 30 秒速解，再展开推导。时间紧的人先拿答案。
- **答案强校验**：`validateVideo` 增加答案与选项交叉校验，不一致就降级重写。

**v0.3 · 内容密度**
- `micro-drill` 镜：答案后立刻一道同考点变式题。
- `summary` 镜：3 条清单回顾，而不是一段泛泛 takeaway。
- 语法结构可视化：从纯文本结构升级为标注树（主干/定语/状语分色）。
- 考点标签与真题关联：从单题走向考点图谱。

**v0.4 · 编辑效率（省 token 的关键）**
- **局部重新配音**：改一镜只付一镜的 TTS 成本，不整片重生成。
- **缓存分层**：L2 脚本缓存（改音色/语速只重配音、零 LLM）、L3 分镜音频缓存（按文本 hash）、L4 导出缓存。
- 分镜级拖拽增删。

**v1.0 · 平台化**
- 协同编辑协议（`presence` + `patch`，传输交宿主接 WebSocket）。
- Web Component 绑定，扩大复用面。
- `onTelemetry` 埋点：统计「哪类分镜被反复 seek」，用行为反推内容质量。

### 我的优先级建议

如果只能做一件事，做 **互动暂停点**。因为它把「看视频」变成「做题」，是留存与效果的分水岭，而且实现上只加一个 kind，不破坏现有协议。

如果能做两件，第二件做 **局部重新配音 + L2/L3 缓存**。它直接决定「老师愿不愿意改稿」——改一次稿就重花 7k token，没人敢改。

### 一条不变的约束

每加一个能力，都要问一句：**它是否让 SDK 开始联网、开始存状态、开始做业务判断？**

如果答案是「是」，那它就应该待在宿主侧，SDK 只留一个回调或一个载荷字段。这条边界是这套代码能独立成一个库的原因，也是最该守住的东西。

---

## 结语 · 三个自测问题

读完这份稿子，如果你能顺畅回答下面三个问题，说明你已经吃透它了：

1. 为什么用户拖动进度条之后，画面和字幕不会错位？（提示：谁是时钟、seek 的三步顺序）
2. 为什么改一句字幕不会让画面跳走？（提示：文本与时间轴解耦）
3. 如果明天要给视频加「暂停提问」功能，你需要改哪几个文件？（提示：kind + 组件 + ShotStage，协议不必动）

答案分别在第 6、8、7 幕里。想动手验证，回到 `RUNBOOK.md` 的路径 A，两分钟就能跑起来。
