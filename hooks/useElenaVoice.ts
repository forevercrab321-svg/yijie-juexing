import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ElenaLineId,
  ElenaExpression,
  ELENA_LINES,
  lineAudioUrl,
} from '../lib/elena';
import { synthesizeVoice } from '../services/api';

/**
 * 艾琳娜的声音。全应用**只有这一条音轨**。
 *
 * 三条路径：
 *   - speakLine(id)     固定台词。优先播放预生成 mp3，零延迟、零额度消耗。
 *                       音频缺失（没跑过资产脚本）时自动退回实时合成，不会静音。
 *   - speakText(str)    一次性的动态台词。会打断当前一切。
 *   - enqueueSpeech(s)  对话中的一句。**排队**依次播放，不打断前面的句子。
 *
 * 为什么 enqueueSpeech 要单独一条：
 * 对话是流式生成的，一段话会被切成好几句陆续送进来。
 * 如果沿用 speakText 的「后来者打断前者」语义，她会只说出最后一句，
 * 前面的全被吞掉。排队才能把一段话完整讲完。
 *
 * 同一时刻只允许一条语音在响。每次打断递增 token，
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

  /**
   * 待播队列。存的是 Promise 而不是文本——入队时就立刻发起合成，
   * 几句话并行合成、按序播放，第二句往往在第一句还没播完时就备好了。
   */
  const queue = useRef<Promise<AudioBuffer | null>[]>([]);
  const draining = useRef(false);

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

  /** 掐断当前正在响的那一声。不碰队列。 */
  const killCurrent = useCallback(() => {
    if (currentSource.current) {
      try {
        currentSource.current.onended = null;
        currentSource.current.stop();
      } catch {
        /* 已经停了 */
      }
      currentSource.current = null;
    }
  }, []);

  /** 全停：掐声音、清队列、作废所有在途任务。玩家打断她时走这条。 */
  const stop = useCallback(() => {
    playbackToken.current++;
    queue.current = [];
    draining.current = false;
    killCurrent();
    setIsSpeaking(false);
  }, [killCurrent]);

  /** 播一段，播完才 resolve。队列依赖这个「播完」的语义来排序。 */
  const playAwait = useCallback(
    async (token: number, buffer: AudioBuffer): Promise<void> => {
      if (token !== playbackToken.current) return;
      const ctx = await getContext();
      if (token !== playbackToken.current) return;

      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        currentSource.current = source;
        source.onended = () => {
          if (currentSource.current === source) currentSource.current = null;
          resolve();
        };
        source.start();
      });
    },
    [getContext],
  );

  /** 合成一段文本并解码。失败返回 null——一句没合成出来不该让整段话停住。 */
  const synthesize = useCallback(
    async (text: string): Promise<AudioBuffer | null> => {
      try {
        const { audioBase64 } = await synthesizeVoice(text);
        const ctx = await getContext();
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return await ctx.decodeAudioData(bytes.buffer);
      } catch (e) {
        console.error('Elena voice failure:', e);
        return null;
      }
    },
    [getContext],
  );

  /** 队列消费者。同一时刻只会有一个在跑。 */
  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    const token = playbackToken.current;

    try {
      setIsSpeaking(true);
      while (queue.current.length > 0) {
        if (token !== playbackToken.current) return; // 被打断了
        const buffer = await queue.current.shift()!;
        if (token !== playbackToken.current) return;
        if (buffer) await playAwait(token, buffer);
      }
    } finally {
      draining.current = false;
      if (token === playbackToken.current) setIsSpeaking(false);
    }
  }, [playAwait]);

  /**
   * 把一句话排进队列。合成立刻开始，播放按入队顺序。
   * 对话流式生成时每切出一句就调一次。
   */
  const enqueueSpeech = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      queue.current.push(synthesize(trimmed));
      void drain();
    },
    [synthesize, drain],
  );

  /** 一次性动态台词。打断当前一切，然后单独说这一句。 */
  const speakText = useCallback(
    async (text: string) => {
      stop();
      enqueueSpeech(text);
    },
    [stop, enqueueSpeech],
  );

  /** 播放固定台词。优先用预生成音频，同时把表情切到这句台词对应的那张。 */
  const speakLine = useCallback(
    async (id: ElenaLineId) => {
      stop();
      setExpression(ELENA_LINES[id].expression);
      const token = playbackToken.current;

      const cached = bufferCache.current.get(id);
      if (cached) {
        setIsSpeaking(true);
        await playAwait(token, cached);
        if (token === playbackToken.current) setIsSpeaking(false);
        return;
      }

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
        await playAwait(token, buffer);
        if (token === playbackToken.current) setIsSpeaking(false);
      } catch {
        // 没有预生成音频就实时合成。功能不受影响，只是慢一点、耗一点额度。
        if (token !== playbackToken.current) return;
        enqueueSpeech(ELENA_LINES[id].text);
      }
    },
    [stop, getContext, playAwait, enqueueSpeech],
  );

  return {
    isSpeaking,
    expression,
    setExpression,
    speakLine,
    speakText,
    enqueueSpeech,
    stop,
  };
}
