import type { ShotProps } from './types';

/**
 * 原文定位镜：按段号截取原文；若 highlight.sentence 能在正文里精确匹配，则拆句高亮。
 * 匹配不到时不编造，只显示段落并标注「依据段」——符合硬约束「不编造原文」。
 */
export function PassageShot({ shot, context }: ShotProps) {
  const body = context?.body ?? '';
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  const paragraphIndex = shot.highlight?.paragraph;
  const sentence = shot.highlight?.sentence;

  let target = '';
  if (paragraphIndex !== undefined && paragraphs.length > 0) {
    target = paragraphs[Math.min(Math.max(paragraphIndex, 0), paragraphs.length - 1)] ?? '';
  } else if (paragraphs.length > 0) {
    target = paragraphs[0];
  }

  const matched = sentence && target.includes(sentence);
  let nodes: React.ReactNode;
  if (matched && sentence) {
    const at = target.indexOf(sentence);
    nodes = (
      <>
        {target.slice(0, at)}
        <mark className="ev-mark">{sentence}</mark>
        {target.slice(at + sentence.length)}
      </>
    );
  } else {
    nodes = target || '（本次讲解未附带原文，字幕见下方）';
  }

  return (
    <div className="ev-passage">
      <div className="ev-kicker">
        {paragraphIndex !== undefined ? `原文第 ${paragraphIndex + 1} 段 · 解题依据` : '原文 · 解题依据'}
        {matched ? '' : sentence ? ' · 句子未精确匹配，按段展示' : ''}
      </div>
      <div className="ev-passage-body">{nodes}</div>
      {shot.caption ? <div className="ev-shot-caption">{shot.caption}</div> : null}
    </div>
  );
}
