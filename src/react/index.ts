/** @waiyu/explain-video/react —— React 绑定层（react / react-dom 为 peer 依赖） */
export { ExplainVideoPlayer, type ExplainVideoPlayerProps } from './ExplainVideoPlayer';
export { TranscriptEditor, type TranscriptEditorProps } from './TranscriptEditor';
export { useTimeline, type UseTimelineOptions, type TimelineController } from './useTimeline';
export { ShotStage } from './shots/ShotStage';
export type { ExplainContext, ShotProps } from './shots/types';
export { CoverShot } from './shots/CoverShot';
export { QuestionShot } from './shots/QuestionShot';
export { PassageShot } from './shots/PassageShot';
export { GrammarShot } from './shots/GrammarShot';
export { EliminateShot } from './shots/EliminateShot';
export { AnswerShot } from './shots/AnswerShot';
export { PointShot } from './shots/PointShot';
export { TakeawayShot } from './shots/TakeawayShot';
export {
  claimPlayback,
  releasePlayback,
  registerPlayer,
  getActivePlayerId,
  subscribeActive,
} from './Coordinator';
