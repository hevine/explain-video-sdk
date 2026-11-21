/**
 * 时间轴驱动：一个 audio 元素轮流播放 N 个分镜音频，rAF 把 audio.currentTime 映射为整片毫秒。
 *
 * 设计要点：
 * - seek 时先切到目标分镜音频，再在 loadedmetadata 后设置镜内 currentTime；
 * - 编辑逐字稿不触发音频 reload（文本与时间轴解耦）；
 * - 所有宿主回调走 ref，避免 rAF 闭包拿到旧 props。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clampMs,
  computeTimeline,
  cueAt,
  shotIndexAt,
  type Cue,
  type ExplainVideo,
  type ShotRange,
} from '../index';

export interface UseTimelineOptions {
  /** 宿主把鉴权 URL 换成 blob URL 的钩子；SDK 自己不发网络请求 */
  audioUrlResolver?: (url: string) => string | Promise<string>;
  onShotChange?: (index: number) => void;
  onTimeChange?: (ms: number) => void;
  onEnded?: () => void;
  /** 播放前调用：宿主在此 claimMediaPlayback，避免与朗读串台 */
  onRequestPlay?: () => void;
}

export interface TimelineController {
  ranges: ShotRange[];
  totalMs: number;
  currentMs: number;
  playing: boolean;
  rate: number;
  shotIndex: number;
  cue: Cue | null;
  audioRef: React.RefObject<HTMLAudioElement>;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (ms: number) => void;
  seekShot: (index: number) => void;
  next: () => void;
  prev: () => void;
  setRate: (rate: number) => void;
}

function toSec(ms: number): number {
  return Math.max(0, ms) / 1000;
}

export function useTimeline(video: ExplainVideo, options: UseTimelineOptions = {}): TimelineController {
  const tl = useMemo(
    () => computeTimeline(video.shots, video.language),
    [video.shots, video.language],
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);

  const currentMsRef = useRef(0);
  const playingRef = useRef(false);
  const rateRef = useRef(1);
  const activeShotRef = useRef(-1);
  const loadedUrlRef = useRef('');
  const rafRef = useRef(0);
  const endedRef = useRef(false);

  const publish = useCallback((ms: number) => {
    currentMsRef.current = ms;
    setCurrentMs(ms);
  }, []);

  const setPlayingFlag = useCallback((value: boolean) => {
    playingRef.current = value;
    setPlaying(value);
  }, []);

  /** 把 audio 切到指定分镜的指定偏移；autoplay 时开始播放 */
  const loadInto = useCallback(
    async (index: number, offsetMs: number, autoplay: boolean) => {
      const audio = audioRef.current;
      const shot = video.shots[index];
      if (!audio || !shot) return;
      endedRef.current = false;

      let url = shot.audio.url;
      try {
        const resolved = optionsRef.current.audioUrlResolver?.(url);
        if (resolved) url = await resolved;
      } catch {
        // 解析失败仍用原 URL 交给 audio 自己报错，避免整片卡死
      }

      const needReload = activeShotRef.current !== index || loadedUrlRef.current !== url;
      const applyOffset = () => {
        const durationSec = Number.isFinite(audio.duration) ? audio.duration : 0;
        const maxSec = Math.max(0, durationSec - 0.02);
        try {
          audio.currentTime = Math.min(toSec(offsetMs), maxSec);
        } catch {
          // 某些浏览器在 metadata 未就绪时拒绝设置，忽略即可
        }
        audio.playbackRate = rateRef.current;
        if (autoplay) {
          void audio.play().catch(() => setPlayingFlag(false));
        }
      };

      if (needReload) {
        audio.pause();
        activeShotRef.current = index;
        loadedUrlRef.current = url;
        audio.src = url;
        if (audio.readyState >= 1) {
          applyOffset();
        } else {
          const onMeta = () => {
            audio.removeEventListener('loadedmetadata', onMeta);
            applyOffset();
          };
          audio.addEventListener('loadedmetadata', onMeta);
        }
      } else {
        applyOffset();
      }
    },
    [video.shots, setPlayingFlag],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlayingFlag(false);
  }, [setPlayingFlag]);

  const play = useCallback(() => {
    optionsRef.current.onRequestPlay?.();
    const atEnd = currentMsRef.current >= tl.totalMs - 1;
    const target = atEnd ? 0 : currentMsRef.current;
    if (atEnd) publish(0);
    setPlayingFlag(true);
    const index = Math.max(0, shotIndexAt(tl.ranges, target));
    const range = tl.ranges[index];
    void loadInto(index, Math.max(0, target - (range?.startMs ?? 0)), true);
  }, [tl, loadInto, publish, setPlayingFlag]);

  const seek = useCallback(
    (ms: number) => {
      const target = clampMs(ms, tl.totalMs);
      publish(target);
      optionsRef.current.onTimeChange?.(target);
      if (tl.ranges.length === 0) return;
      const index = Math.max(0, shotIndexAt(tl.ranges, Math.min(target, tl.totalMs - 0.001)));
      const range = tl.ranges[index];
      void loadInto(index, Math.max(0, target - (range?.startMs ?? 0)), playingRef.current);
    },
    [tl, loadInto, publish],
  );

  const seekShot = useCallback(
    (index: number) => {
      const i = Math.max(0, Math.min(tl.ranges.length - 1, index));
      const range = tl.ranges[i];
      if (range) seek(range.startMs);
    },
    [tl, seek],
  );

  const next = useCallback(() => {
    seekShot((activeShotRef.current < 0 ? shotIndexAt(tl.ranges, currentMsRef.current) : activeShotRef.current) + 1);
  }, [seekShot, tl]);

  const prev = useCallback(() => {
    seekShot((activeShotRef.current < 0 ? shotIndexAt(tl.ranges, currentMsRef.current) : activeShotRef.current) - 1);
  }, [seekShot, tl]);

  const setRate = useCallback((value: number) => {
    const nextRate = [0.75, 1, 1.25, 1.5, 2].includes(value) ? value : 1;
    rateRef.current = nextRate;
    setRateState(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  }, []);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  // rAF 主循环：读取 audio.currentTime → 整片毫秒；跨镜自动切下一段
  useEffect(() => {
    const tick = () => {
      const audio = audioRef.current;
      if (audio && playingRef.current && audio.readyState >= 2 && activeShotRef.current >= 0) {
        const index = activeShotRef.current;
        const range = tl.ranges[index];
        if (range) {
          const ms = range.startMs + toSec(audio.currentTime) * 1000;
          if (ms >= range.endMs && !endedRef.current) {
            endedRef.current = true;
            const nextIndex = index + 1;
            if (nextIndex < tl.ranges.length) {
              publish(tl.ranges[nextIndex].startMs);
              void loadInto(nextIndex, 0, true);
            } else {
              publish(tl.totalMs);
              pause();
              optionsRef.current.onEnded?.();
            }
          } else if (ms < range.endMs) {
            publish(ms);
            optionsRef.current.onTimeChange?.(ms);
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tl, loadInto, pause, publish]);

  // 换片：重置到 0 并停掉当前音频
  useEffect(() => {
    activeShotRef.current = -1;
    loadedUrlRef.current = '';
    endedRef.current = false;
    publish(0);
    setPlayingFlag(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [video.id, publish, setPlayingFlag]);

  const shotIndex = useMemo(
    () => (tl.totalMs <= 0 ? -1 : shotIndexAt(tl.ranges, Math.min(currentMs, tl.totalMs - 0.001))),
    [tl, currentMs],
  );
  const cue = useMemo(() => cueAt(video.cues, currentMs), [video.cues, currentMs]);

  // 分镜变化通知（用 ref 记住上一次，避免重复触发）
  const lastNotifiedRef = useRef(-1);
  useEffect(() => {
    if (shotIndex !== lastNotifiedRef.current) {
      lastNotifiedRef.current = shotIndex;
      if (shotIndex >= 0) optionsRef.current.onShotChange?.(shotIndex);
    }
  }, [shotIndex]);

  // 音频自然结束：兜底走下一段（部分浏览器 rAF 跨镜判定会漏）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const nextIndex = activeShotRef.current + 1;
      if (nextIndex < tl.ranges.length) {
        publish(tl.ranges[nextIndex].startMs);
        void loadInto(nextIndex, 0, true);
      } else {
        publish(tl.totalMs);
        setPlayingFlag(false);
        optionsRef.current.onEnded?.();
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [tl, loadInto, publish, setPlayingFlag]);

  return {
    ranges: tl.ranges,
    totalMs: tl.totalMs,
    currentMs,
    playing,
    rate,
    shotIndex,
    cue,
    audioRef,
    play,
    pause,
    toggle,
    seek,
    seekShot,
    next,
    prev,
    setRate,
  };
}
