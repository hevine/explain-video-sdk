import type { ShotProps } from './types';

const LETTERS = 'ABCDEFGH';

/**
 * 答案镜：只渲染 shot 自带快照；高亮索引来自 highlight.picked。
 * 宿主后端必须保证 picked === question.answer，SDK 不参与判定。
 */
export function AnswerShot({ shot }: ShotProps) {
  const options = shot.options ?? [];
  const picked = shot.highlight?.picked;
  return (
    <div className="ev-answer">
      <div className="ev-kicker">正确答案 · 为什么对</div>
      {options.map((opt, i) =>
        i === picked ? (
          <div key={i} className="ev-answer-right">
            <span className="ev-answer-badge">✓ 正确</span>
            <span className="ev-answer-letter">{LETTERS[i] ?? i + 1}</span>
            <span className="ev-option-text">{opt}</span>
          </div>
        ) : null,
      )}
      {shot.caption ? <div className="ev-shot-caption">{shot.caption}</div> : null}
    </div>
  );
}
