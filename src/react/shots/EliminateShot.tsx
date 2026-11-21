import type { ShotProps } from './types';

const LETTERS = 'ABCDEFGH';

/** 排除镜：picked 指定的选项逐项划掉，options 指定的用于聚焦 */
export function EliminateShot({ shot, step = 0 }: ShotProps) {
  const options = shot.options ?? [];
  const picked = shot.highlight?.picked;
  const focus = shot.highlight?.options ?? [];
  return (
    <div className="ev-eliminate">
      <div className="ev-kicker">逐项排除 · 为什么错</div>
      <ul className="ev-options">
        {options.map((opt, i) => {
          const struck = picked === i || (focus.includes(i) && step >= i);
          return (
            <li key={i} className={`ev-option${struck ? ' ev-option-struck' : ''}`}>
              <span className="ev-option-letter">{LETTERS[i] ?? i + 1}</span>
              <span className="ev-option-text">{opt}</span>
              {struck ? <span className="ev-option-x">✕</span> : null}
            </li>
          );
        })}
      </ul>
      {shot.caption ? <div className="ev-shot-caption">{shot.caption}</div> : null}
    </div>
  );
}
