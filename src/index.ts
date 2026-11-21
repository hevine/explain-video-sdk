/**
 * @waiyu/explain-video · 核心入口（框架无关）
 *
 * 只导出类型 + 纯函数。需要播放器 UI 时用 `@waiyu/explain-video/react`。
 * SDK 不做网络请求、不读 localStorage、不依赖宿主 store —— 可在 demo 里独立运行。
 */
export type {
  Language,
  QuestionLike,
  NarrationLanguage,
  ShotKind,
  ShotHighlight,
  GrammarFocus,
  ExamPoint,
  ShotAudio,
  Shot,
  Cue,
  ExplainVideo,
  ThemeTokens,
  ExplainVideoHandle,
  TranscriptEditEvent,
  ExportManifest,
} from './types';

export type { ShotRange, Timeline, Boundary } from './timeline';
export {
  computeTimeline,
  withTimeline,
  clampMs,
  cueAt,
  shotIndexAt,
  formatTime,
  validateVideo,
  normalizeShots,
  applyTranscriptEdit,
  buildExportManifest,
  estimateDurationSec,
  groupCuesByShot,
  demoShots,
  weightedSplit,
} from './timeline';

export { ExplainVideoError, InvalidVideoError, TimelineError } from './errors';
