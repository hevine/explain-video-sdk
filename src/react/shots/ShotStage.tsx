import type { ShotProps } from './types';
import { CoverShot } from './CoverShot';
import { QuestionShot } from './QuestionShot';
import { PassageShot } from './PassageShot';
import { GrammarShot } from './GrammarShot';
import { EliminateShot } from './EliminateShot';
import { AnswerShot } from './AnswerShot';
import { PointShot } from './PointShot';
import { TakeawayShot } from './TakeawayShot';

/** 分镜调度器：按 shot.kind 选渲染器，业务数据由宿主通过 shot 快照传入 */
export function ShotStage(props: ShotProps) {
  switch (props.shot.kind) {
    case 'cover':
      return <CoverShot {...props} />;
    case 'question':
      return <QuestionShot {...props} />;
    case 'passage':
      return <PassageShot {...props} />;
    case 'grammar':
      return <GrammarShot {...props} />;
    case 'eliminate':
      return <EliminateShot {...props} />;
    case 'answer':
      return <AnswerShot {...props} />;
    case 'point':
      return <PointShot {...props} />;
    case 'takeaway':
      return <TakeawayShot {...props} />;
    default:
      return <div className="ev-shot-caption">{props.shot.caption}</div>;
  }
}
