import { describe, expect, it } from 'vitest';
import {
  applyTranscriptEdit,
  buildExportManifest,
  clampMs,
  computeTimeline,
  cueAt,
  formatTime,
  groupCuesByShot,
  shotIndexAt,
  validateVideo,
  withTimeline,
  type ExplainVideo,
  type Shot,
} from '../src/index';

function shot(i: number, durationMs: number, narration = `Sentence ${i}. More words here.`): Shot {
  return {
    id: `s${i}`,
    kind: i === 0 ? 'cover' : 'question',
    narration,
    caption: `字幕 ${i}`,
    audio: { url: `/seg/${i}`, durationMs },
  };
}

function makeVideo(shots: Shot[]): ExplainVideo {
  const tl = computeTimeline(shots, 'en');
  return {
    id: 'v1',
    articleId: 'a1',
    language: 'en',
    narrationLanguage: 'target',
    voice: 'en-US-AvaNeural',
    title: 'test',
    totalMs: tl.totalMs,
    shots,
    cues: tl.cues,
    createdAt: new Date().toISOString(),
  };
}

describe('computeTimeline', () => {
  it('累加分镜时长得到 totalMs', () => {
    const tl = computeTimeline([shot(0, 1000), shot(1, 2500), shot(2, 700)], 'en');
    expect(tl.totalMs).toBe(4200);
    expect(tl.ranges.map((r) => [r.startMs, r.endMs])).toEqual([
      [0, 1000],
      [1000, 3500],
      [3500, 4200],
    ]);
  });

  it('cue 覆盖每个分镜，第一句字幕用 caption', () => {
    const tl = computeTimeline([shot(0, 3000), shot(1, 2000)], 'en');
    expect(tl.cues.length).toBeGreaterThanOrEqual(2);
    expect(tl.cues[0].text).toBe('字幕 0');
    expect(tl.cues.every((c) => c.endMs > c.startMs)).toBe(true);
    expect(tl.cues.every((c) => c.startMs >= 0 && c.endMs <= tl.totalMs)).toBe(true);
  });

  it('boundaries 精确切分时尊重 offset/duration 与末镜边界', () => {
    const s = shot(0, 5000);
    const tl = computeTimeline([s], 'en', {
      s0: [
        { text: 'A.', offsetMs: 0, durationMs: 1200 },
        { text: 'B.', offsetMs: 1200, durationMs: 1500 },
      ],
    });
    expect(tl.cues).toHaveLength(2);
    expect(tl.cues[0].startMs).toBe(0);
    expect(tl.cues[0].endMs).toBe(1200);
    expect(tl.cues[1].startMs).toBe(1200);
    expect(tl.cues[1].endMs).toBe(5000); // 末个 cue 吸收到镜尾
  });

  it('空旁白也有兜底 cue', () => {
    const tl = computeTimeline([shot(0, 1000, '')], 'en');
    expect(tl.cues).toHaveLength(1);
  });

  it('零时长分镜不产生 cue', () => {
    const tl = computeTimeline([shot(0, 0)], 'en');
    expect(tl.cues).toHaveLength(0);
    expect(tl.totalMs).toBe(0);
  });
});

describe('lookup / clamp / format', () => {
  const tl = computeTimeline([shot(0, 1000), shot(1, 2000)], 'en');

  it('cueAt 命中与间隙回退', () => {
    expect(cueAt(tl.cues, 100)?.shotIndex).toBe(0);
    expect(cueAt(tl.cues, 1500)?.shotIndex).toBe(1);
    expect(cueAt([], 10)).toBeNull();
  });

  it('shotIndexAt 命中、越界钳制', () => {
    expect(shotIndexAt(tl.ranges, 500)).toBe(0);
    expect(shotIndexAt(tl.ranges, 1500)).toBe(1);
    expect(shotIndexAt(tl.ranges, 99999)).toBe(1);
    expect(shotIndexAt([], 0)).toBe(-1);
  });

  it('clampMs 与 formatTime', () => {
    expect(clampMs(-5, 3000)).toBe(0);
    expect(clampMs(4000, 3000)).toBe(3000);
    expect(clampMs(NaN, 3000)).toBe(0);
    expect(formatTime(61234)).toBe('01:01.2');
  });
});

describe('validation', () => {
  it('合法 video 无问题', () => {
    const v = makeVideo([shot(0, 1000), shot(1, 2000)]);
    expect(validateVideo(v)).toEqual([]);
  });

  it('抓出 totalMs 不一致与非法时长', () => {
    const v = makeVideo([shot(0, 1000)]);
    v.totalMs = 9999;
    v.shots[0].audio.durationMs = -3;
    const issues = validateVideo(v);
    expect(issues.some((s) => s.includes('totalMs'))).toBe(true);
    expect(issues.some((s) => s.includes('时长非法'))).toBe(true);
  });

  it('答案镜缺 picked / picked 越界', () => {
    const a = shot(0, 1000);
    a.kind = 'answer';
    a.options = ['A', 'B'];
    const v = makeVideo([a]);
    expect(validateVideo(v).some((s) => s.includes('picked'))).toBe(true);
    a.highlight = { picked: 5 };
    expect(validateVideo(v).some((s) => s.includes('越界'))).toBe(true);
  });
});

describe('transcript editing', () => {
  it('编辑只改文本与时间轴解耦', () => {
    const v = makeVideo([shot(0, 1000)]);
    const before = v.cues[0];
    const next = applyTranscriptEdit(v, before.id, 'narration', '改过的逐字稿');
    expect(next.cues[0].narration).toBe('改过的逐字稿');
    expect(next.cues[0].edited).toBe(true);
    expect(next.cues[0].startMs).toBe(before.startMs);
    expect(next.cues[0].endMs).toBe(before.endMs);
    expect(next.totalMs).toBe(v.totalMs);
    expect(v.cues[0].narration).not.toBe('改过的逐字稿'); // 不改入参
  });

  it('未知 cueId 返回原对象', () => {
    const v = makeVideo([shot(0, 1000)]);
    expect(applyTranscriptEdit(v, 'nope', 'text', 'x')).toBe(v);
  });

  it('withTimeline 重算但不丢元数据', () => {
    const v = makeVideo([shot(0, 1000)]);
    const next = withTimeline(v);
    expect(next.id).toBe(v.id);
    expect(next.totalMs).toBe(v.totalMs);
  });
});

describe('export manifest', () => {
  it('frames 与 audioUrls 顺序对齐分镜', () => {
    const v = makeVideo([shot(0, 1000), shot(1, 2000)]);
    const m = buildExportManifest(v);
    expect(m.frames).toHaveLength(2);
    expect(m.audioUrls).toHaveLength(2);
    expect(m.frames[0].startMs).toBe(0);
    expect(m.frames[1].startMs).toBe(1000);
    expect(m.totalMs).toBe(3000);
  });

  it('groupCuesByShot 按镜分组', () => {
    const v = makeVideo([shot(0, 1000), shot(1, 2000)]);
    const groups = groupCuesByShot(v.cues, 2);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.length > 0)).toBe(true);
  });
});
