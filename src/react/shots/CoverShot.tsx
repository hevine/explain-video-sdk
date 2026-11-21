import type { ShotProps } from './types';

export function CoverShot({ shot, video }: ShotProps) {
  const count = video.shots.filter((s) => s.kind === 'question').length;
  return (
    <div className="ev-cover">
      <div className="ev-cover-kicker">解题答疑 · AI 精读讲解</div>
      <div className="ev-cover-title">{shot.caption || video.title}</div>
      <div className="ev-cover-meta">
        <span className="ev-pill">{count ? `${count} 道题` : '逐句精讲'}</span>
        <span className="ev-pill ev-pill-soft">{video.language.toUpperCase()}</span>
        <span className="ev-pill ev-pill-soft">
          {video.narrationLanguage === 'target' ? '目标语讲解 · 中文字幕' : '中文讲解'}
        </span>
      </div>
    </div>
  );
}
