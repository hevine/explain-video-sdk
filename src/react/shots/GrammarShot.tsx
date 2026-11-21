import type { ShotProps } from './types';

/** 语法镜：句子 → 结构 → 讲解 → 译文，四段式，AI 教授口吻由旁白承担 */
export function GrammarShot({ shot }: ShotProps) {
  const g = shot.grammar;
  if (!g) return <div className="ev-shot-caption">{shot.caption}</div>;
  return (
    <div className="ev-grammar">
      <div className="ev-kicker">语法拆解 · Grammar Focus</div>
      <div className="ev-grammar-sentence">{g.sentence}</div>
      {g.structure ? (
        <div className="ev-grammar-structure">
          <span className="ev-tag">结构</span>
          {g.structure}
        </div>
      ) : null}
      {g.explanation ? <div className="ev-grammar-note">{g.explanation}</div> : null}
      {g.translation ? <div className="ev-grammar-translation">译：{g.translation}</div> : null}
      {shot.caption ? <div className="ev-shot-caption">{shot.caption}</div> : null}
    </div>
  );
}
