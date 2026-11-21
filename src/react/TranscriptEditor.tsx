/**
 * 逐字稿编辑器：按「分镜 → 句子」两级展示，逐句可编辑旁白与字幕。
 *
 * 实时同步的关键：编辑只改 video.cues 的文本字段，时间戳完全不动（applyTranscriptEdit），
 * 所以调用 onEdit 后父组件 state 更新 → 播放器字幕立刻变化，音频不错位。
 * SDK 不落盘、不请求网络；宿主通过 onEdit 拿到的 video 自行持久化。
 */
import { memo, useMemo, useState } from 'react';
import { applyTranscriptEdit, formatTime, groupCuesByShot, type ExplainVideo } from '../index';

export interface TranscriptEditorProps {
  video: ExplainVideo;
  /** 当前播放毫秒，用于高亮正在讲的那句 */
  currentMs: number;
  /** 是否展示旁白输入框（目标语讲解时可编辑 TTS 文本） */
  showNarration?: boolean;
  /** 编辑事件：宿主拿 event.video 持久化（回调持久化） */
  onEdit: (cueId: string, field: 'text' | 'narration', value: string, nextVideo: ExplainVideo) => void;
  /** 点时间跳转 */
  onSeek?: (ms: number) => void;
  className?: string;
}

const KIND_LABEL: Record<string, string> = {
  cover: '片头',
  question: '题干',
  passage: '原文',
  grammar: '语法',
  eliminate: '排除',
  answer: '答案',
  point: '考点',
  takeaway: '小结',
};

function TranscriptEditorImpl({
  video,
  currentMs,
  showNarration = true,
  onEdit,
  onSeek,
  className,
}: TranscriptEditorProps) {
  const [openShots, setOpenShots] = useState<Set<number>>(() => new Set([0]));
  const groups = useMemo(
    () => groupCuesByShot(video.cues, video.shots.length),
    [video.cues, video.shots.length],
  );

  const toggle = (i: number) => {
    setOpenShots((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const edit = (cueId: string, field: 'text' | 'narration', value: string) => {
    const nextVideo = applyTranscriptEdit(video, cueId, field, value);
    onEdit(cueId, field, value, nextVideo);
  };

  return (
    <section className={`ev-transcript${className ? ` ${className}` : ''}`} aria-label="逐字稿编辑">
      <div className="ev-transcript-head">
        <strong>逐字稿</strong>
        <span className="ev-hint">点句子可跳转 · 编辑即时同步到播放</span>
      </div>
      <div className="ev-transcript-list">
        {video.shots.map((shot, i) => {
          const cues = groups[i] ?? [];
          const open = openShots.has(i);
          const active = cues.some((c) => c.startMs <= currentMs && currentMs < c.endMs);
          return (
            <div key={shot.id} className={`ev-ts-shot${active ? ' ev-ts-shot-active' : ''}`}>
              <button type="button" className="ev-ts-shot-head" onClick={() => toggle(i)}>
                <span className="ev-ts-idx">{i + 1}</span>
                <span className="ev-ts-kind">{KIND_LABEL[shot.kind] ?? shot.kind}</span>
                <span className="ev-ts-shot-caption">{shot.caption}</span>
                <span className="ev-ts-caret">{open ? '▾' : '▸'}</span>
              </button>
              {open ? (
                <div className="ev-ts-cues">
                  {cues.length === 0 ? (
                    <div className="ev-hint" style={{ padding: '6px 10px' }}>
                      该镜无逐字稿（音频时长为 0）
                    </div>
                  ) : null}
                  {cues.map((cue) => {
                    const isCurrent = cue.startMs <= currentMs && currentMs < cue.endMs;
                    return (
                      <div key={cue.id} className={`ev-ts-cue${isCurrent ? ' ev-ts-cue-active' : ''}`}>
                        <button
                          type="button"
                          className="ev-ts-time"
                          onClick={() => onSeek?.(cue.startMs)}
                          title="跳到这一句"
                        >
                          {formatTime(cue.startMs)}
                        </button>
                        <div className="ev-ts-fields">
                          <input
                            className="ev-ts-input"
                            value={cue.text}
                            onChange={(e) => edit(cue.id, 'text', e.target.value)}
                            aria-label="字幕"
                            placeholder="字幕"
                          />
                          {showNarration ? (
                            <textarea
                              className="ev-ts-textarea"
                              value={cue.narration}
                              onChange={(e) => edit(cue.id, 'narration', e.target.value)}
                              rows={2}
                              aria-label="旁白"
                              placeholder="旁白（可编辑，用于重新配音）"
                            />
                          ) : null}
                        </div>
                        {cue.edited ? <span className="ev-ts-dirty" title="已修改">已改</span> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const TranscriptEditor = memo(TranscriptEditorImpl);
