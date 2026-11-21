import type { ShotProps } from './types';

const LETTERS = 'ABCDEFGH';

export function QuestionShot({ shot }: ShotProps) {
  const options = shot.options ?? [];
  const focus = shot.highlight?.options ?? [];
  const picked = shot.highlight?.picked;
  return (
    <div className="ev-question">
      {shot.questionNo !== undefined ? (
        <div className="ev-kicker">第 {shot.questionNo + 1} 题 · 题干</div>
      ) : null}
      {shot.prompt ? <div className="ev-prompt">{shot.prompt}</div> : null}
      {options.length > 0 ? (
        <ul className="ev-options">
          {options.map((opt, i) => {
            const isFocus = focus.includes(i) || picked === i;
            return (
              <li key={i} className={`ev-option${isFocus ? ' ev-option-focus' : ''}`}>
                <span className="ev-option-letter">{LETTERS[i] ?? i + 1}</span>
                <span className="ev-option-text">{opt}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {shot.caption ? <div className="ev-shot-caption">{shot.caption}</div> : null}
    </div>
  );
}
