/**
 * 时间轴纯函数：无副作用、无 DOM、无 React，可在 Node / 浏览器 / 测试里直接跑。
 *
 * 核心约定：
 * - shot 的时长来自后端 edge-tts 的 SentenceBoundary（durationMs），累加即得每镜起点；
 * - cue 在镜内按 narration 的句子长度比例分配时间（fallback），或从后端传入 boundaries 精确切；
 * - 编辑逐字稿只改文本，不改任何时间戳 —— 保证「编辑即时反映」与「音频时间轴」解耦。
 */
import type { Cue, ExplainVideo, Language, Shot } from './types';
import { InvalidVideoError } from './errors';

export interface ShotRange {
  shotIndex: number;
  startMs: number;
  endMs: number;
}

export interface Timeline {
  ranges: ShotRange[];
  totalMs: number;
  cues: Cue[];
}

/** 一个边界事件：offsetMs / durationMs 相对所属分镜起点 */
export interface Boundary {
  text: string;
  offsetMs: number;
  durationMs: number;
}

const SPLIT_RE: Record<Language, RegExp> = {
  // 英文按句末标点切，保留标点；空串兜底
  en: /(?<=[.!?。！？])\s+/,
  ja: /(?<=[。！？])/,
  ko: /(?<=[.!?。！？])\s*/,
};

function splitSentences(text: string, language: Language): string[] {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];
  const pieces = trimmed
    .split(SPLIT_RE[language] ?? SPLIT_RE.en)
    .map((s) => s.trim())
    .filter(Boolean);
  return pieces.length > 0 ? pieces : [trimmed];
}

/** 把一段旁白切成 n 份，按字符长度加权；n <= 0 或空串返回空数组 */
function weightedSplit(text: string, n: number): string[] {
  if (n <= 0 || !text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  if (words.length <= n) {
    // 词数不够时把尾部词并到最后一个 bucket，避免出现空 cue
    const out: string[] = [];
    const per = Math.max(1, Math.ceil(words.length / n));
    for (let i = 0; i < n; i += 1) {
      const slice = words.slice(i * per, (i + 1) * per).join(' ');
      if (slice) out.push(slice);
    }
    return out.length > 0 ? out : [text];
  }
  const weights = words.map((w) => Math.max(1, w.length));
  const total = weights.reduce((a, b) => a + b, 0);
  const target = total / n;
  const out: string[] = [];
  let bucket: string[] = [];
  let acc = 0;
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    bucket.push(word);
    acc += weights[i] + (bucket.length > 1 ? 1 : 0);
    if (acc >= target && out.length < n - 1) {
      out.push(bucket.join(' '));
      bucket = [];
      acc = 0;
    }
  }
  if (bucket.length) out.push(bucket.join(' '));
  return out;
}

/** 从 shot 推导整片时间轴。boundaries 若提供且与旁白句数吻合，则优先用精确边界。 */
export function computeTimeline(
  shots: Shot[],
  language: Language = 'en',
  boundariesByShot?: Record<string, Boundary[]>,
): Timeline {
  const ranges: ShotRange[] = [];
  const cues: Cue[] = [];
  let cursor = 0;

  shots.forEach((shot, shotIndex) => {
    const duration = Math.max(0, Math.round(shot.audio?.durationMs ?? 0));
    const startMs = cursor;
    const endMs = cursor + duration;
    ranges.push({ shotIndex, startMs, endMs });
    cursor = endMs;

    const boundaries = boundariesByShot?.[shot.id];
    let local: Array<{ text: string; startMs: number; endMs: number }> = [];

    if (boundaries && boundaries.length > 0) {
      local = boundaries
        .map((b) => ({
          text: b.text,
          startMs: startMs + Math.max(0, Math.round(b.offsetMs)),
          endMs: startMs + Math.round(b.offsetMs + b.durationMs),
        }))
        .filter((b) => b.endMs > b.startMs)
        .map((b, i, arr) => ({
          ...b,
          endMs: i === arr.length - 1 ? endMs : Math.min(b.endMs, endMs),
        }));
    } else {
      const sentences = splitSentences(shot.narration, language);
      const parts = sentences.length > 0 ? sentences : [shot.narration].filter(Boolean);
      if (parts.length > 0 && duration > 0) {
        // 按字符长度比例分配镜内时长，最后一句吸收取整误差
        const weights = parts.map((s) => Math.max(1, s.length));
        const total = weights.reduce((a, b) => a + b, 0);
        let acc = 0;
        let localCursor = startMs;
        parts.forEach((part, i) => {
          const isLast = i === parts.length - 1;
          const len = isLast
            ? endMs - localCursor
            : Math.max(1, Math.round((duration * weights[i]) / total));
          acc += len;
          local.push({ text: part, startMs: localCursor, endMs: localCursor + len });
          localCursor += len;
        });
        // acc 仅用于防御性断言，实际时长以 endMs 为准
        void acc;
      }
    }

    local.forEach((item, cueIndex) => {
      cues.push({
        id: `s${shotIndex}-c${cueIndex}`,
        shotIndex,
        text: cueIndex === 0 ? shot.caption : item.text,
        narration: item.text,
        startMs: Math.max(startMs, item.startMs),
        endMs: Math.min(endMs, item.endMs),
      });
    });

    // 极端兜底：音频有时长但旁白为空，仍造一个 cue，保证字幕栏不空
    if (local.length === 0 && duration > 0) {
      cues.push({
        id: `s${shotIndex}-c0`,
        shotIndex,
        text: shot.caption,
        narration: shot.narration,
        startMs,
        endMs,
      });
    }
  });

  return { ranges, totalMs: cursor, cues };
}

/** 用 computeTimeline 的结果补全一个 ExplainVideo（纯函数，不改入参） */
export function withTimeline(video: ExplainVideo, boundariesByShot?: Record<string, Boundary[]>): ExplainVideo {
  const tl = computeTimeline(video.shots, video.language, boundariesByShot);
  return { ...video, totalMs: tl.totalMs, cues: tl.cues };
}

export function clampMs(ms: number, totalMs: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.min(totalMs, ms));
}

/** 二分查找当前 cue；ms 落在间隙时返回上一个 cue（视觉上字幕保持到下一句） */
export function cueAt(cues: Cue[], ms: number): Cue | null {
  if (cues.length === 0) return null;
  let lo = 0;
  let hi = cues.length - 1;
  let ans: Cue | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid];
    if (cue.startMs <= ms) {
      ans = cue;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** 查找当前分镜索引；ranges 来自 computeTimeline */
export function shotIndexAt(ranges: ShotRange[], ms: number): number {
  if (ranges.length === 0) return -1;
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (ms < r.startMs) hi = mid - 1;
    else if (ms >= r.endMs) lo = mid + 1;
    else return mid;
  }
  // 落在尾部 / 间隙：返回最接近的一个
  return Math.max(0, Math.min(ranges.length - 1, lo === 0 ? 0 : lo - 1));
}

/** 毫秒 → mm:ss.s（播放器控制条用） */
export function formatTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const dec = Math.floor((safe % 1000) / 100);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${dec}`;
}

/**
 * 代码侧校验（不信模型）。返回问题列表，空数组表示通过。
 * 答案权威性由宿主后端保证；这里只校验时间轴自洽与结构完整。
 */
export function validateVideo(video: ExplainVideo): string[] {
  const issues: string[] = [];
  if (!video || typeof video !== 'object') return ['video 不是对象'];
  if (!Array.isArray(video.shots) || video.shots.length === 0) issues.push('没有分镜');
  if (!video.id) issues.push('缺少 id');
  if (!video.articleId) issues.push('缺少 articleId');

  let cursor = 0;
  video.shots?.forEach((shot, i) => {
    const d = shot.audio?.durationMs;
    if (!Number.isFinite(d) || d <= 0) issues.push(`分镜 ${i} 音频时长非法：${d}`);
    else cursor += Math.round(d);
    if (!shot.id) issues.push(`分镜 ${i} 缺少 id`);
    if (shot.kind === 'answer' && shot.highlight?.picked === undefined) {
      issues.push(`分镜 ${i} 是答案镜但没有 picked`);
    }
    const optCount = shot.options?.length ?? 0;
    if (shot.highlight?.picked !== undefined && optCount > 0) {
      const picked = shot.highlight.picked;
      if (!Number.isInteger(picked) || picked < 0 || picked >= optCount) {
        issues.push(`分镜 ${i} picked=${picked} 越界（选项数 ${optCount}）`);
      }
    }
  });

  if (Math.abs(cursor - (video.totalMs ?? 0)) > 1) {
    issues.push(`totalMs=${video.totalMs} 与各镜时长累加 ${cursor} 不一致`);
  }
  const ids = new Set<string>();
  video.cues?.forEach((cue, i) => {
    if (ids.has(cue.id)) issues.push(`cue id 重复：${cue.id}`);
    ids.add(cue.id);
    if (cue.endMs <= cue.startMs) issues.push(`cue ${i} 时间区间非法`);
    if (cue.startMs < 0 || cue.endMs > (video.totalMs ?? 0) + 1) issues.push(`cue ${i} 超出整片范围`);
  });
  return issues;
}

/** 对分镜做幂等 id 补齐，避免模型 / 手写 JSON 漏 id 导致编辑锚点失效 */
export function normalizeShots(shots: Shot[]): Shot[] {
  return shots.map((shot, i) => ({
    ...shot,
    id: shot.id || `s${i}`,
    audio: {
      url: shot.audio?.url ?? '',
      durationMs: Math.max(0, Math.round(shot.audio?.durationMs ?? 0)),
    },
  }));
}

/** 编辑逐字稿：只改文本，时间轴完全不动 —— 保证浏览器实时预览与音频不错位 */
export function applyTranscriptEdit(
  video: ExplainVideo,
  cueId: string,
  field: 'text' | 'narration',
  value: string,
): ExplainVideo {
  let changed = false;
  const cues = video.cues.map((cue) => {
    if (cue.id !== cueId) return cue;
    changed = true;
    return { ...cue, [field]: value, edited: true };
  });
  if (!changed) return video;
  return { ...video, cues, updatedAt: new Date().toISOString() };
}

/** 导出清单：SDK 只产出数据，真正画帧 + 拼音轨交给宿主后端（ffmpeg） */
export function buildExportManifest(video: ExplainVideo): {
  videoId: string;
  title: string;
  totalMs: number;
  frames: Array<{ shotIndex: number; startMs: number; endMs: number; kind: string; caption: string; lines: string[] }>;
  audioUrls: string[];
} {
  const ranges = computeTimeline(video.shots, video.language).ranges;
  return {
    videoId: video.id,
    title: video.title,
    totalMs: video.totalMs,
    frames: video.shots.map((shot, i) => ({
      shotIndex: i,
      startMs: ranges[i]?.startMs ?? 0,
      endMs: ranges[i]?.endMs ?? 0,
      kind: shot.kind,
      caption: shot.caption,
      lines: [
        shot.prompt ?? '',
        ...(shot.options ?? []),
        shot.grammar?.sentence ?? '',
        shot.grammar?.structure ?? '',
        shot.point?.label ?? '',
        shot.point?.text ?? '',
      ].filter(Boolean),
    })),
    audioUrls: video.shots.map((s) => s.audio.url),
  };
}

/** 整镜时长估算（秒），用于生成前的 token / 时长提示 */
export function estimateDurationSec(shots: Array<{ narration: string }>, charsPerSec = 4.2): number {
  const chars = shots.reduce((sum, s) => sum + (s.narration?.length ?? 0), 0);
  return Math.round(chars / Math.max(1, charsPerSec));
}

/** 把 cue 列表按分镜分组，供逐字稿编辑器「镜 · 句」两级展示 */
export function groupCuesByShot(cues: Cue[], shotCount: number): Cue[][] {
  const groups: Cue[][] = Array.from({ length: shotCount }, () => []);
  cues.forEach((cue) => {
    if (cue.shotIndex >= 0 && cue.shotIndex < shotCount) groups[cue.shotIndex].push(cue);
  });
  return groups;
}

/** 供 demo 使用：从旁白文本造一份极简分镜（无网络） */
export function demoShots(narrations: string[], language: Language = 'en'): Shot[] {
  return narrations.map((text, i) => ({
    id: `s${i}`,
    kind: (['cover', 'question', 'passage', 'takeaway'] as const)[i % 4] ?? 'question',
    narration: text,
    caption: text,
    questionNo: i > 0 ? i - 1 : undefined,
    audio: { url: `seg-${i}.mp3`, durationMs: Math.max(2000, text.length * 260) },
  }));
}

export { weightedSplit };
