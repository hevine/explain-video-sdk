import type { ShotProps } from './types';

/** 考点提示镜：标签 + 一句可记忆的话 */
export function PointShot({ shot }: ShotProps) {
  const point = shot.point;
  return (
    <div className="ev-point">
      <div className="ev-kicker">考点提示 · Exam Point</div>
      {point?.label ? <div className="ev-point-label">{point.label}</div> : null}
      {point?.text ? <div className="ev-point-text">{point.text}</div> : null}
      {shot.caption ? <div className="ev-shot-caption">{shot.caption}</div> : null}
    </div>
  );
}
