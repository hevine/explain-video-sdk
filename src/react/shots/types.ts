import type { ExplainVideo, QuestionLike, Shot } from '../../index';

/** 宿主可选传入的文章上下文：让 passage / grammar 镜能对照原文高亮 */
export interface ExplainContext {
  body?: string;
  translation?: string;
  questions?: QuestionLike[];
}

export interface ShotProps {
  shot: Shot;
  video: ExplainVideo;
  context?: ExplainContext;
  /** 当前是否处于「讲解深潜」子步骤，用于逐项动画（0 基） */
  step?: number;
}
