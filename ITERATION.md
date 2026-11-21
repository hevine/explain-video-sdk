# 解题答疑视频 SDK · 后续迭代细化清单

> 状态：MVP 已可用（音频时间轴 + 8 类 Div 分镜 + seek + 逐字稿实时编辑 + MP4 导出）。
> 目标：从「把题目讲一遍」升级为「真正帮用户学会」—— teach → practice → recall 三段闭环。
> 原则：SDK 只做协议、时间轴、渲染与编辑；LLM / TTS / 存储始终留在宿主。所有新能力优先以「分镜载荷 + 宿主回调」形式扩展，不把网络与业务逻辑塞进 SDK。

## 一、教学价值：让视频更像「AI 教授」而非「朗读稿」

| 优先级 | 细化点 | 具体做法 | 用户收益 |
| --- | --- | --- | --- |
| P0 | 分层讲解（先结论后展开） | 新增 `depth` 字段（brief / standard / deep），同一道题生成两套旁白：先看 30 秒速解，再展开逐项排除；播放器提供「只看速解」开关 | 时间紧的用户先拿答案，想深学的再看推导 |
| P0 | 互动暂停点 | 新分镜类型 `quiz`：在排除前插入「先自己选」的停帧，用户点击选项后才继续播放；`onAnswer` 回调宿主记录作答 | 从被动听讲变成主动练习 |
| P0 | 错题/答案权威性强校验 | SDK 侧 `validateVideo` 增加 `answer` 与题目选项的交叉校验；宿主 LLM 输出与题库答案不一致时降级为「题库答案 + 讲解重写一次」 | 杜绝 AI 讲错题，这是答疑产品的底线 |
| P1 | 原文可点词注释 | `passage` 镜支持词级 `token` 元数据（词形/释义/考点），hover 即显中文；与宿主词库打通 | 讲解过程中顺手背词，不必跳走查词典 |
| P1 | 语法结构可视化 | `grammar` 镜从纯文本结构升级为标注树（主干/定语/状语分色），SVG 或嵌套 Div 渲染 | 长难句「看得见」结构，而不是听一段中文解释 |
| P1 | 考点标签与真题关联 | `point` 镜增加 `examTag` / `frequency` / `relatedQuestionIds`；点击跳转同考点其他题 | 从单题讲解扩展到考点图谱 |
| P1 | 跟读/影子练习 | 每个 cue 提供 `shadowMode`：按句暂停、录音、回放对比；SDK 只发 `onRecord` 事件，评分交宿主 | 听说能力也能借这套视频练 |
| P2 | 记忆卡片导出 | `buildExportManifest` 扩展输出 Anki 格式（正面=题目、背面=考点+语法），宿主导出 | 看完视频直接进复习队列 |
| P2 | 个性化口播风格 | `theme` 扩展 `voice persona`（严谨教授 / 陪练学伴），由宿主 TTS 参数体现；SDK 提供切换 UI | 不同水平 learner 匹配不同语气 |

## 二、内容密度：MVP「内容少」的直接解法

当前 4 题约 22 镜 / 3–4 分钟，信息量偏薄。建议按下面的配额扩写（宿主 prompt 与分镜类型同步扩展）：

1. **每题镜数下限**：question → passage → grammar（可选）→ eliminate（**逐选项一镜**）→ answer → point → micro-drill（新），确保 4 题至少 30 镜。
2. **逐项排除拆镜**：现在 `eliminate` 是一镜讲完所有错项；改成每个错项一镜（`kind: 'eliminate'`, `highlight.picked = i`），配「错因类型」标签（偷换概念 / 无中生有 / 张冠李戴 / 反向）。
3. **增加 `micro-drill` 镜**：答案后立刻给一道同考点的变式小题（宿主从题库取或 LLM 生成），即时巩固。
4. **`summary` 镜**：结尾用 3 条清单回顾本篇考点，而不是一段泛泛 takeaway。
5. **正文精读镜增强**：`passage` 除高亮原句外，补「本句在文中的作用」（主旨句 / 转折 / 例证 / 论据）。
6. **token 预算提示**：宿主按镜数预估并展示（主项目已实现区间提示），避免用户误以为「卡住了」。

## 三、编辑与协作：让老师能真正改稿

| 优先级 | 细化点 | 具体做法 |
| --- | --- | --- |
| P0 | 分镜级重排与增删 | TranscriptEditor 增加镜顺序拖拽、插入/删除镜；`applyTranscriptEdit` 支持结构变更而不仅是文本 |
| P0 | 局部重新配音 | 编辑某镜旁白后，SDK 发 `onNarrationEdit(shotId, text)`，宿主只重合成该段音频、替换 URL；不必整片重生成、不重复扣 token |
| P1 | 编辑多人协同 | 定义 `presence` 与 `patch` 协议（操作差异而非全量 video），宿主接 WebSocket/SSE；SDK 保持传输无关 |
| P1 | 版本对比 | `onTranscriptChange` 带 revision 号，支持「回到上一版」；宿主存草稿版本 |
| P2 | 字幕烧录样式可调 | 导出 Manifest 携带字号/位置/背景，宿主 ffmpeg 复用同一套配置 |

## 四、工程化：成本、性能、可靠性

1. **缓存分层（最高 ROI）**
   - L1 原型：`hash(articleId, voice, rate, scriptVersion, questions, body, translation)` → 主项目已实现。
   - L2 脚本缓存：LLM 脚本单独落盘，改音色/语速时**只重合成音频**，零 LLM 调用。
   - L3 分镜缓存：按 `shot.kind + 旁白文本 hash` 缓存音频，编辑一镜只付一镜的 TTS 成本。
   - L4 导出缓存：mp4 与 manifest 的 revision 绑定，未改稿直接复用。
2. **增量生成**：长文分题流式生成，前端先播前几题、后台继续；job 协议增加 `partialVideoId`。
3. **可观测性**：SDK 发 `onTelemetry`（play / seek / cue_edit / shot_change / error），宿主接埋点；统计「哪类分镜被反复 seek」反推内容质量。
4. **无障碍**：分镜语义标签、字幕高亮的 ARIA live region、键盘空格播放 / 左右键 seek。
5. **主题与嵌入式**：`theme` 支持完整 CSS 变量注入；提供无控制条的 `EmbedPlayer` 便于宿主自定义外壳。
6. **非 React 绑定**：核心已是框架无关，补 Vue / Web Component 包装，扩大复用面。

## 五、建议排期

- **v0.2（教学闭环）**：互动暂停点 + 逐项排除拆镜 + 答案权威性强校验 + 分层讲解开关。
- **v0.3（内容密度）**：micro-drill / summary 镜 + 语法结构可视化 + 考点标签。
- **v0.4（编辑效率）**：局部重新配音 + 分镜拖拽 + L2/L3 缓存（省 token 的关键一步）。
- **v1.0（平台化）**：协同编辑协议、Web Component、埋点与质量看板。

> 每完成一版，务必同步更新 `src/types.ts` 协议、`test/` 单测与 `demo/`，并保持「SDK 零网络依赖」的边界不变。
