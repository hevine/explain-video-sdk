import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExplainVideoPlayer } from '../src/react';
import { computeTimeline, type ExplainVideo, type Shot, type TranscriptEditEvent } from '../src/index';
import '../src/styles.css';

/**
 * 用 WebAudio 现场生成一段「静音 + 极轻正弦」WAV 当作每段分镜的音频，
 * 让 demo 在没有 mp3 文件、没有 ffmpeg、没有网络的情况下也能验证时间轴 / seek / 字幕同步。
 */
function makeWavDataUrl(durationMs: number, freq = 220): string {
  const rate = 8000;
  const samples = Math.max(1, Math.floor((durationMs / 1000) * rate));
  const bytes = samples * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, bytes, true);
  for (let i = 0; i < samples; i += 1) {
    const t = i / rate;
    const value = Math.sin(2 * Math.PI * freq * t) * 0.02;
    view.setInt16(44 + i * 2, value * 0x7fff, true);
  }
  const u8 = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < u8.length; i += 4096) {
    bin += String.fromCharCode(...u8.subarray(i, i + 4096));
  }
  return `data:audio/wav;base64,${btoa(bin)}`;
}

const PASSAGE =
  'Reading is one of the best habits a learner can build. It exposes you to new words in context, and it trains your brain to think in the target language. Even fifteen minutes a day can make a real difference.';

function buildVideo(): ExplainVideo {
  const shots: Shot[] = [
    {
      id: 's0',
      kind: 'cover',
      narration: 'In this lesson, we will solve one reading question together.',
      caption: '这节课，我们一起攻克一道阅读理解题。',
      audio: { url: 'wav:0', durationMs: 4000 },
    },
    {
      id: 's1',
      kind: 'question',
      questionNo: 0,
      narration: 'Question one. What is the main idea of the passage?',
      caption: '第一题：这篇文章的主旨是什么？',
      prompt: 'What is the main idea of the passage?',
      options: [
        'The benefits of building a reading habit.',
        'How to memorize new words quickly.',
        'Why fifteen minutes is not enough.',
        'The history of language learning.',
      ],
      audio: { url: 'wav:1', durationMs: 6000 },
    },
    {
      id: 's2',
      kind: 'passage',
      questionNo: 0,
      narration: 'Look at the first sentence. It says reading is one of the best habits.',
      caption: '看第一句：阅读是最好的习惯之一。',
      highlight: { paragraph: 0, sentence: 'Reading is one of the best habits a learner can build.' },
      audio: { url: 'wav:2', durationMs: 6000 },
    },
    {
      id: 's3',
      kind: 'answer',
      questionNo: 0,
      narration: 'So the correct answer is A. The whole passage is about the benefits of reading.',
      caption: '所以正确答案是 A：全文都在讲阅读的好处。',
      prompt: 'What is the main idea of the passage?',
      options: [
        'The benefits of building a reading habit.',
        'How to memorize new words quickly.',
        'Why fifteen minutes is not enough.',
        'The history of language learning.',
      ],
      highlight: { picked: 0 },
      audio: { url: 'wav:3', durationMs: 6000 },
    },
    {
      id: 's4',
      kind: 'takeaway',
      narration: 'Remember, find the topic sentence first, then check the details.',
      caption: '记住：先找主题句，再核对细节。',
      audio: { url: 'wav:4', durationMs: 4000 },
    },
  ];
  const tl = computeTimeline(shots, 'en');
  return {
    id: 'demo-video-1',
    articleId: 'demo-article',
    language: 'en',
    narrationLanguage: 'target',
    voice: 'en-US-AvaNeural',
    title: 'Reading Habit · 主旨题精讲',
    totalMs: tl.totalMs,
    shots,
    cues: tl.cues,
    createdAt: new Date().toISOString(),
  };
}

function Demo() {
  const video = useMemo(buildVideo, []);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [saved, setSaved] = useState(0);
  const [lastEdit, setLastEdit] = useState<string>('');

  const resolver = (url: string): string => {
    const hit = cacheRef.current.get(url);
    if (hit) return hit;
    const idx = Number(url.split(':')[1] ?? 0);
    const data = makeWavDataUrl([4000, 6000, 6000, 6000, 4000][idx] ?? 5000);
    cacheRef.current.set(url, data);
    return data;
  };

  const onTranscript = (event: TranscriptEditEvent) => {
    setSaved((n) => n + 1);
    setLastEdit(`${event.field}: ${event.value.slice(0, 30)}`);
    // event.video 即编辑后的完整 video，宿主可直接 POST 持久化
    console.log('[demo] transcript change', event.cueId, event.field, event.video.cues.length, 'cues');
  };

  useEffect(() => {
    // 无操作：仅为展示 hooks 用法
  }, []);

  return (
    <>
      <ExplainVideoPlayer
        video={video}
        context={{ body: PASSAGE }}
        editable
        audioUrlResolver={resolver}
        theme={{ accent: '#4f7cff' }}
        onTranscriptChange={onTranscript}
        onEnded={() => setLastEdit('播放结束')}
      />
      <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>
        已保存编辑：{saved} 次 · 最近：{lastEdit || '—'}
      </p>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
