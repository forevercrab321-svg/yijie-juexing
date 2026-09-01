import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ElenaLineId,
  ElenaExpression,
  ELENA_LINES,
  lineAudioUrl,
} from '../lib/elena';
import { synthesizeVoice } from '../services/api';

/**
 * 艾琳娜的语音播放。
 *
 * 两条路径：
 *   - speakLine(id)  固定台词。优先播放预生成的 mp3，零延迟、零额度消耗。
 *                    音频文件缺失（没跑过资产脚本）时自动退回实时合成，不会静音。
 *   - speakText(str) 含动态内容的台词，只能实时合成。
 *
 * 同一时刻只允许一条语音在播。每次播放递增 token，
 * 让异步链路上的旧任务能识别出自己已被取代，不去污染新语音的状态。
 */
export function useElenaVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  /**
   * 当前表情。说完不自动复位——刚道完喜就立刻变回面无表情会很怪，
   * 保持到下一句台词为止更接近真人。
   */
  const [expression, setExpression] = useState<ElenaExpression>('neutral');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSource = useRef<AudioBufferSourceNode | null>(null);
  const playbackToken = useRef(0);
  /** 已解码的固定台词，避免同一句反复解码 */
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());

  useEffect(() => () => { void audioCtxRef.current?.close(); }, []);

  const getContext = useCallback(async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  }, []);

  const stop = useCallback(() => {
    playbackToken.current++;
    if (currentSource.current) {
      try {
        currentSource.current.onended = null;
        currentSource.current.stop();
      } catch {
        /* 已经停了 */
      }
      currentSource.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const play = useCallback(
    async (token: number, buffer: AudioBuffer) => {
      if (token !== playbackToken.current) return;
      const ctx = await getContext();
      if (token !== playbackToken.current) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      currentSource.current = source;
      source.onended = () => {
        if (token !== playbackToken.current) return;
        setIsSpeaking(false);
        currentSource.current = null;
      };
      source.start();
    },
    [getContext],
  );

  /** 实时合成并播放。用于含动态内容、无法预生成的台词。 */
  const speakText = useCallback(
    async (text: string) => {
      const token = ++playbackToken.current;
      if (currentSource.current) {
        try {
          currentSource.current.onended = null;
          currentSource.current.stop();
        } catch {
          /* 已经停了 */
        }
        currentSource.current = null;
      }

      try {
        setIsSpeaking(true);
        const { audioBase64 } = await synthesizeVoice(text);
        if (token !== playbackToken.current) return;

        const ctx = await getContext();
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const buffer = await ctx.decodeAudioData(bytes.buffer);
        await play(token, buffer);
      } catch (e) {
        console.error('Elena voice failure:', e);
        if (token === playbackToken.current) setIsSpeaking(false);
      }
    },
    [getContext, play],
  );

  /** 播放固定台词。优先用预生成音频，同时把表情切到这句台词对应的那张。 */
  const speakLine = useCallback(
    async (id: ElenaLineId) => {
      setExpression(ELENA_LINES[id].expression);

      const cached = bufferCache.current.get(id);
      if (cached) {
        const token = ++playbackToken.current;
        setIsSpeaking(true);
        await play(token, cached);
        return;
      }

      const token = ++playbackToken.current;
      setIsSpeaking(true);

      try {
        const res = await fetch(lineAudioUrl(id));
        // 资产脚本没跑过时这里会 404；某些 dev server 会用 index.html 兜底，
        // 所以顺带确认一下确实拿到的是音频。
        const isAudio = res.ok && (res.headers.get('Content-Type') ?? '').includes('audio');
        if (!isAudio) throw new Error('preRendered audio unavailable');

        const ctx = await getContext();
        const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        bufferCache.current.set(id, buffer);
        await play(token, buffer);
      } catch {
        // 没有预生成音频就实时合成。功能不受影响，只是慢一点、耗一点额度。
        if (token !== playbackToken.current) return;
        await speakText(ELENA_LINES[id].text);
      }
    },
    [getContext, play, speakText],
  );

  return { isSpeaking, expression, setExpression, speakLine, speakText, stop };
}
