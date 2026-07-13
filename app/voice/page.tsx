'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, X, Volume2, VolumeX, Loader2, Square, Pause } from 'lucide-react';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Turn { role: 'user' | 'assistant'; content: string; }

export default function VoicePage() {
  const router = useRouter();
  const [state, setState] = useState<VoiceState>('idle');
  const [muted, setMuted] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // cleanup
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
  }, []);

  const stateLabel = {
    idle: 'اضغط وتكلّم',
    listening: 'أسمعك...',
    thinking: 'أفكّر...',
    speaking: 'أردّ عليك...',
  }[state];

  async function startListening() {
    setError(null);
    if (state !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = handleRecorderStop;
      mediaRecorderRef.current = mr;
      mr.start();
      setState('listening');
    } catch (e) {
      setError('يجب السماح بالوصول للميكروفون من المتصفح');
      console.error(e);
    }
  }

  async function stopListening() {
    if (state !== 'listening') return;
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function handleRecorderStop() {
    setState('thinking');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 500) {
        setState('idle');
        setError('ما سجلت أي شي، حاول تاني');
        return;
      }
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      fd.append('history', JSON.stringify(history));

      const res = await fetch('/api/voice', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'الخادم رجع خطأ');
      }
      const data = await res.json();
      setQuestion(data.transcript);
      setAnswer(data.reply);
      setHistory((h) => [
        ...h,
        { role: 'user', content: data.transcript },
        { role: 'assistant', content: data.reply },
      ]);

      if (!muted && data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audioRef.current = audio;
        audio.onended = () => setState('idle');
        audio.onerror = () => setState('idle');
        setState('speaking');
        await audio.play().catch(() => setState('idle'));
      } else {
        setState('idle');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'خطأ غير متوقع';
      setError(msg);
      setState('idle');
    }
  }

  function stopSpeaking() {
    audioRef.current?.pause();
    setState('idle');
  }

  function handleMainTap() {
    if (state === 'idle') startListening();
    else if (state === 'listening') stopListening();
    else if (state === 'speaking') stopSpeaking();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6">
      {/* Top bar */}
      <div className="w-full max-w-2xl flex items-center justify-between">
        <button
          onClick={() => router.back()}
          aria-label="رجوع"
          className="w-10 h-10 rounded-full hover-surface flex items-center justify-center"
        >
          <X className="w-6 h-6" />
        </button>
        <h1 className="font-cairo font-bold text-xl">الصوت الحي</h1>
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'إلغاء الكتم' : 'كتم'}
          className="w-10 h-10 rounded-full hover-surface flex items-center justify-center"
        >
          {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>
      </div>

      {/* Conversation */}
      <div className="w-full max-w-2xl flex-1 flex flex-col gap-3 my-6 overflow-y-auto">
        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm"
               style={{ background: 'rgba(211,47,47,0.15)', color: '#FF6B6B' }}>
            {error}
          </div>
        )}
        {question && (
          <div className="rounded-2xl px-4 py-3 card border border-dark-border">
            <div className="text-xs text-muted mb-1">سألت:</div>
            <div className="text-base">{question}</div>
          </div>
        )}
        {answer && (
          <div className="rounded-2xl px-4 py-3"
               style={{ background: 'rgba(30,102,170,0.15)', borderColor: 'rgba(30,102,170,0.3)', borderWidth: 1 }}>
            <div className="text-xs font-bold mb-1" style={{ color: '#1EA0D1' }}>
              الأستاذ ذكي:
            </div>
            <div className="text-base leading-relaxed">{answer}</div>
          </div>
        )}
      </div>

      {/* Visualizer */}
      <div className="flex flex-col items-center gap-6 mb-8">
        <Visualizer state={state} />
        <div
          className={`font-cairo font-bold text-lg ${state === 'listening' ? '' : 'text-muted'}`}
          style={state === 'listening' ? { color: '#D32F2F' } : undefined}
        >
          {stateLabel}
        </div>

        <button
          onClick={handleMainTap}
          disabled={state === 'thinking'}
          className="w-22 h-22 rounded-full flex items-center justify-center transition-all shadow-2xl disabled:opacity-50"
          style={{
            width: 88, height: 88,
            background: state === 'listening' ? '#D32F2F' : '#1E66AA',
            boxShadow: `0 0 24px ${state === 'listening' ? 'rgba(211,47,47,0.4)' : 'rgba(30,102,170,0.4)'}`,
          }}
        >
          {state === 'listening' ? <Square className="w-10 h-10 text-white" />
            : state === 'thinking' ? <Loader2 className="w-10 h-10 text-white animate-spin" />
            : state === 'speaking' ? <Pause className="w-10 h-10 text-white" />
            : <Mic className="w-10 h-10 text-white" />}
        </button>
      </div>
    </div>
  );
}

function Visualizer({ state }: { state: VoiceState }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (state === 'idle') { setPhase(0); return; }
    const id = setInterval(() => setPhase((p) => (p + 0.05) % 1), 50);
    return () => clearInterval(id);
  }, [state]);

  const heights = [60, 120, 90, 75, 105];
  const color = state === 'listening' ? '#D32F2F'
    : state === 'speaking' ? '#1EA0D1'
    : 'var(--muted)';

  return (
    <div className="flex items-center justify-center gap-2 h-40">
      {heights.map((h, i) => {
        const p = (phase + i * 0.18) % 1;
        const scale = state === 'idle' ? 0.3 : (0.3 + 0.7 * (0.5 + 0.5 * (-(Math.abs(1 - 2 * p)) + 0.5)));
        return (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              width: 10,
              height: state === 'idle' ? 30 : h * scale,
              background: color,
            }}
          />
        );
      })}
    </div>
  );
}
