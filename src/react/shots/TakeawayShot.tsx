import type { ShotProps } from './types';

/** 收尾镜：一篇一技巧，给一句能记住的话 */
export function TakeawayShot({ shot }: ShotProps) {
  return (
    <div className="ev-takeaway">
      <div className="ev-kicker">本篇 takeaway · 记住这一句</div>
      <div className="ev-takeaway-text">{shot.caption || shot.narration}</div>
      <div className="ev-takeaway-foot">再做一遍，把方法变成手感 ✦</div>
    </div>
  );
}
