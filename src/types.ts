/**
 * 解题答疑视频 · 契约层
 *
 * 设计原则（与 HANDOVER-EXPLAIN-VIDEO.md 第 4/8 节一致）：
 * - 时间轴协议是本 SDK 的核心契约，必须独立、可复用、可纯函数推导；
 * - SDK 只接受「已切好的 shot + 已合好的音频 URL」，不做网络请求、不读存储、不依赖宿主 store；
 * - 答案由业务侧权威给出，SDK 只在渲染层消费 highlight.picked，不参与判定。
 */

/** 目标语言代码（与主项目 domain/language 一致） */
export type Language = 'en' | 'ja' | 'ko';

/** 题目快照（与业务侧 Question 结构兼容，但 SDK 不依赖业务类型） */
export interface QuestionLike {
  prompt: string;
  options: string[];
  answer: number;
  explain?: string;
}

/** 讲解旁白语言：target = 目标语讲解 + 中文字幕；zh = 中文讲解 */
export type NarrationLanguage = 'target' | 'zh';

/**
 * 分镜类型。
 * - cover/question/passage/eliminate/answer/takeaway：交接文档定义的六类；
 * - grammar：语法讲解镜（句子拆解 + 语法点），来自用户「语法」诉求；
 * - point：考点提示镜（考点标签 + 提示），来自用户「考点提示与解析」诉求。
 */
export type ShotKind =
  | 'cover'
  | 'question'
  | 'passage'
  | 'grammar'
  | 'eliminate'
  | 'answer'
  | 'point'
  | 'takeaway';

/** 原文高亮指令：定位到段落 / 原句 / 选项集合 / 被排除项 */
export interface ShotHighlight {
  /** 原文第几段（0 基） */
  paragraph?: number;
  /** 要高亮的原句，用于精确匹配；匹配失败时宿主降级为段号 */
  sentence?: string;
  /** 高亮哪些选项（0 基） */
  options?: number[];
  /** 被排除 / 选中的选项（0 基） */
  picked?: number;
}

/** 语法镜的载荷：从原文抽一句，拆结构 + 讲用法 */
export interface GrammarFocus {
  /** 目标语句子（应能在原文 body 中找到） */
  sentence: string;
  /** 句子主干 / 结构标注，如「主语 + 定语从句 + 谓语」 */
  structure: string;
  /** 语法点讲解（可含中文） */
  explanation: string;
  /** 中文译文（可选） */
  translation?: string;
}

/** 考点提示镜的载荷 */
export interface ExamPoint {
  /** 考点标签，如「主旨题 · 转折处」 */
  label: string;
  /** 一句可记忆的提示 */
  text: string;
}

/** 单个分镜的音频信息，由后端合成后填入 */
export interface ShotAudio {
  /** 分段音频 URL（如 /api/explain-videos/:id/seg/:n），SDK 只消费不请求鉴权 */
  url: string;
  /** 来自 edge-tts SentenceBoundary 的精确时长；降级时为估算值 */
  durationMs: number;
}

/** 分镜 */
export interface Shot {
  /** 稳定 id = `s${index}`，编辑逐字稿时用它做锚点 */
  id: string;
  kind: ShotKind;
  /** 该分镜旁白全文（TTS 输入，语言见 video.narrationLanguage） */
  narration: string;
  /** 屏幕字幕（可与旁白不同，更短；中文） */
  caption: string;
  /** 属于第几道题（0 基）；cover/takeaway 可为 undefined */
  questionNo?: number;
  /** 题干快照：question 镜直接渲染，不依赖宿主再用 questionNo 查表 */
  prompt?: string;
  /** 选项快照：question/eliminate/answer 镜直接渲染 */
  options?: string[];
  /** 原文高亮指令 */
  highlight?: ShotHighlight;
  /** 语法镜载荷 */
  grammar?: GrammarFocus;
  /** 考点镜载荷 */
  point?: ExamPoint;
  /** 音频（后端填入） */
  audio: ShotAudio;
}

/**
 * 逐字稿字幕单元（cue）。
 * - 一个 shot 可被切成多个 cue（按 SentenceBoundary 或按标点兜底切）；
 * - startMs/endMs 为相对整片的绝对毫秒，由 computeTimeline 推导，编辑文本不改变时间轴；
 * - text 为屏幕字幕，narration 为可编辑的旁白文本（宿主可据此重新配音）。
 */
export interface Cue {
  /** 稳定 id = `s{shotIndex}-c{cueIndex}` */
  id: string;
  shotIndex: number;
  /** 屏幕字幕（中文） */
  text: string;
  /** 可编辑旁白文本（语言见 video.narrationLanguage） */
  narration: string;
  startMs: number;
  endMs: number;
  /** 用户是否编辑过（用于 UI 标记「已改稿」） */
  edited?: boolean;
}

/** 一部完整的解题答疑视频 */
export interface ExplainVideo {
  id: string;
  /** 绑定文章 id；换一篇后 id 变化，旧视频自然失效 */
  articleId: string;
  language: Language;
  narrationLanguage: NarrationLanguage;
  /** 音色 id（如 zh-CN-XiaoxiaoNeural / ja-JP-NanamiNeural） */
  voice: string;
  title: string;
  /** 整片总时长（毫秒） */
  totalMs: number;
  shots: Shot[];
  cues: Cue[];
  createdAt: string;
  updatedAt?: string;
}

/** 主题变量：宿主用 CSS 变量覆盖即可换肤，不写死颜色 */
export interface ThemeTokens {
  accent?: string;
  accentSoft?: string;
  ink?: string;
  inkSoft?: string;
  surface?: string;
  surfaceAlt?: string;
  line?: string;
  font?: string;
  fontSerif?: string;
}

/** 播放器对外暴露的受控句柄 */
export interface ExplainVideoHandle {
  play: () => void;
  pause: () => void;
  /** 跳到绝对毫秒；SDK 内部 clamp 到 [0, totalMs] */
  seek: (ms: number) => void;
  /** 跳到第 n 个分镜（0 基） */
  seekShot: (index: number) => void;
  /** 上一个 / 下一个分镜 */
  next: () => void;
  prev: () => void;
  /** 1 / 1.25 / 1.5 / 2 */
  setRate: (rate: number) => void;
  /** 当前时间（毫秒），读实时值 */
  getCurrentMs: () => number;
  /** 当前分镜索引 */
  getShotIndex: () => number;
}

/** 逐字稿编辑事件：宿主据此持久化（本地实时预览 + 回调持久化） */
export interface TranscriptEditEvent {
  cueId: string;
  shotIndex: number;
  field: 'text' | 'narration';
  value: string;
  /** 应用编辑后的完整 video（时间轴未变），可直接 POST 给宿主保存 */
  video: ExplainVideo;
}

/** 导出清单：SDK 产出纯数据，具体 mp4 合成交给宿主后端（ffmpeg） */
export interface ExportManifest {
  videoId: string;
  title: string;
  totalMs: number;
  /** 每镜的静态画面文本快照；宿主据此画帧 + 拼接音轨 */
  frames: Array<{
    shotIndex: number;
    startMs: number;
    endMs: number;
    kind: ShotKind;
    caption: string;
    lines: string[];
  }>;
  /** 分段音频 URL 顺序 */
  audioUrls: string[];
}
