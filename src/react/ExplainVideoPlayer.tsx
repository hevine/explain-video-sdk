/**
 * ExplainVideoPlayer —— SDK 主组件。
 *
 * 能力：音频时间轴驱动的分镜播放（Div 渲染）· seek · 倍速 · 字幕跟随 ·
 *       分镜跳转 · 逐字稿即时编辑与实时同步 · 与宿主播放权互斥。
 *
 * 约束：不做任何网络请求（音频 URL 由宿主经 audioUrlResolver 转成可播放地址）；
 *       不读 localStorage / 宿主 store；状态只在组件内，编辑通过 onTranscriptChange 回调宿主持久化。
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  applyTranscriptEdit,
  formatTime,
  type ExplainVideo,
  type ExplainVideoHandle,
  type ThemeTokens,
  type TranscriptEditEvent,
} from '../index';
import { useTimeline, type UseTimelineOptions } from './useTimeline';
import { claimPlayback, registerPlayer } from './Coordinator';
import { ShotStage } from './shots/ShotStage';
import type { ExplainContext } from './shots/types';
import { TranscriptEditor } from './TranscriptEditor';

export interface ExplainVideoPlayerProps {
  video: ExplainVideo;
  /** 文章上下文：passage 镜高亮原句用；不传则只显示分镜自带 caption */
  context?: ExplainContext;
  theme?: ThemeTokens;
  /** 是否显示逐字稿编辑器（默认 true） */
  editable?: boolean;
  /** 默认展开逐字稿（默认 false） */
  transcriptOpen?: boolean;
  /** 音频 URL 解析（宿主可在此把鉴权 URL fetch 成 blob） */
  audioUrlResolver?: UseTimelineOptions['audioUrlResolver'];
  onShotChange?: (index: number) => void;
  onEnded?: () => void;
  /** 播放前调用，宿主在此 claimMediaPlayback('explain') 与朗读互斥 */
  onRequestPlay?: () => void;
  /** 编辑即回调（本地实时预览 + 宿主持久化） */
  onTranscriptChange?: (event: TranscriptEditEvent) => void;
  className?: string;
  style?: CSSProperties;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

export const ExplainVideoPlayer = forwardRef<ExplainVideoHandle, ExplainVideoPlayerProps>(
  function ExplainVideoPlayer(
    {
      video: videoProp,
      context,
      theme,
      editable = true,
      transcriptOpen = false,
      audioUrlResolver,
      onShotChange,
      onEnded,
      onRequestPlay,
      onTranscriptChange,
      className,
      style,
    },
    ref,
  ) {
    // 组件持有 video 的可编辑副本：换片（id 变化）时重置；编辑只在此副本上进行
    const [video, setVideo] = useState<ExplainVideo>(videoProp);
    const lastIdRef = useRef(videoProp.id);
    if (lastIdRef.current !== videoProp.id) {
      lastIdRef.current = videoProp.id;
      setVideo(videoProp);
    }
    useEffect(() => {
      setVideo(videoProp);
    }, [videoProp]);

    const [showTranscript, setShowTranscript] = useState(transcriptOpen);
    const instanceId = useId();
    const seekingRef = useRef(false);

    const tl = useTimeline(video, {
      audioUrlResolver,
      onShotChange,
      onEnded,
      onRequestPlay: () => {
        claimPlayback(instanceId);
        onRequestPlay?.();
      },
    });

    // 注册进 SDK 内部协调器，避免两个播放器同屏串台
    useEffect(() => {
      return registerPlayer(instanceId, { stop: () => tl.pause() });
    }, [instanceId, tl]);

    useImperativeHandle(
      ref,
      () => ({
        play: tl.play,
        pause: tl.pause,
        seek: tl.seek,
        seekShot: tl.seekShot,
        next: tl.next,
        prev: tl.prev,
        setRate: tl.setRate,
        getCurrentMs: () => tl.currentMs,
        getShotIndex: () => tl.shotIndex,
      }),
      [tl],
    );

    const handleEdit = useCallback(
      (cueId: string, field: 'text' | 'narration', value: string, nextVideo: ExplainVideo) => {
        setVideo(nextVideo);
        const cue = nextVideo.cues.find((c) => c.id === cueId);
        onTranscriptChange?.({
          cueId,
          shotIndex: cue?.shotIndex ?? 0,
          field,
          value,
          video: applyTranscriptEdit(nextVideo, cueId, field, value),
        });
      },
      [onTranscriptChange],
    );

    const themeStyle = useMemo(() => {
      const map: Record<keyof ThemeTokens, string> = {
        accent: '--ev-accent',
        accentSoft: '--ev-accent-soft',
        ink: '--ev-ink',
        inkSoft: '--ev-ink-soft',
        surface: '--ev-surface',
        surfaceAlt: '--ev-surface-alt',
        line: '--ev-line',
        font: '--ev-font',
        fontSerif: '--ev-font-serif',
      };
      const out: Record<string, string> = {};
      (Object.keys(theme ?? {}) as Array<keyof ThemeTokens>).forEach((key) => {
        const value = theme?.[key];
        if (value) out[map[key]] = value;
      });
      return out as CSSProperties;
    }, [theme]);

    const shot = tl.shotIndex >= 0 ? video.shots[tl.shotIndex] : null;
    const progress = tl.totalMs > 0 ? (tl.currentMs / tl.totalMs) * 100 : 0;

    return (
      <div
        className={`ev-root${className ? ` ${className}` : ''}`}
        style={{ ...themeStyle, ...style }}
        data-kind={shot?.kind ?? 'cover'}
      >
        <audio ref={tl.audioRef} preload="metadata" style={{ display: 'none' }} />

        {/* 画面：分镜用 Div 渲染，无 canvas / 无 mp4 依赖 */}
        <div className="ev-stage" onClick={() => tl.toggle()}>
          {shot ? <ShotStage shot={shot} video={video} context={context} /> : null}
          {tl.cue ? <div className="ev-subtitle">{tl.cue.text}</div> : null}
          {!tl.playing && tl.currentMs === 0 ? (
            <div className="ev-big-play" aria-hidden>
              ▶
            </div>
          ) : null}
        </div>

        {/* 分镜进度点：点分镜跳转 */}
        <div className="ev-dots" role="tablist" aria-label="分镜跳转">
          {video.shots.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === tl.shotIndex}
              className={`ev-dot${i === tl.shotIndex ? ' ev-dot-active' : ''}`}
              title={`${i + 1}. ${s.caption}`}
              onClick={() => tl.seekShot(i)}
            />
          ))}
        </div>

        {/* 控制条 */}
        <div className="ev-controls">
          <button type="button" className="ev-btn" onClick={tl.prev} title="上一镜">
            ⏮
          </button>
          <button type="button" className="ev-btn ev-btn-main" onClick={tl.toggle} title={tl.playing ? '暂停' : '播放'}>
            {tl.playing ? '❚❚' : '▶'}
          </button>
          <button type="button" className="ev-btn" onClick={tl.next} title="下一镜">
            ⏭
          </button>
          <span className="ev-time">
            {formatTime(tl.currentMs)} / {formatTime(tl.totalMs)}
          </span>
          <input
            className="ev-seek"
            type="range"
            min={0}
            max={Math.max(1, tl.totalMs)}
            step={100}
            value={tl.currentMs}
            onPointerDown={() => {
              seekingRef.current = true;
            }}
            onPointerUp={() => {
              seekingRef.current = false;
            }}
            onChange={(e) => tl.seek(Number(e.target.value))}
            aria-label="播放进度"
            style={{ ['--ev-progress' as string]: `${progress}%` }}
          />
          <select
            className="ev-rate"
            value={tl.rate}
            onChange={(e) => tl.setRate(Number(e.target.value))}
            aria-label="倍速"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
          {editable ? (
            <button
              type="button"
              className={`ev-btn ev-btn-text${showTranscript ? ' ev-btn-on' : ''}`}
              onClick={() => setShowTranscript((v) => !v)}
            >
              逐字稿
            </button>
          ) : null}
        </div>

        {editable && showTranscript ? (
          <TranscriptEditor
            video={video}
            currentMs={tl.currentMs}
            onEdit={handleEdit}
            onSeek={tl.seek}
          />
        ) : null}
      </div>
    );
  },
);
