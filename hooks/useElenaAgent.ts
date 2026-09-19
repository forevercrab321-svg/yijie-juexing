import { useCallback, useRef, useState } from 'react';
import { streamChat, ApiError } from '../services/api';
import {
  ChatMessage,
  DisplayTurn,
  ToolCall,
  describeAction,
  takeSentences,
  trimHistory,
} from '../lib/agent/conversation';
import { ToolContext, executeTool } from '../lib/agent/tools';
import { PROFESSION_CONFIG } from '../constants';
import { hasSttEngine, sttEngineName, transcribe } from '../lib/agent/stt';
import {
  ElenaContext,
  ElenaExpression,
  parseExpressionTag,
} from '../lib/elena';

/** 一轮对话里最多让她连续调几次工具。防的是模型陷在「查了又查」的循环里烧额度。 */
const MAX_TOOL_ROUNDS = 3;

/**
 * 表情标记的等待窗口。
 *
 * 标记在回复最前面，但流式下第一个 chunk 可能只有 "[ex"。
 * 攒够这么多字符还没等到完整标记，就当她忘了加，按 neutral 处理并把文本放行——
 * 不能为了等一个标记让她迟迟不开口。
 */
const TAG_WINDOW = 24;

export interface ElenaAgentOptions {
  /** 每次调用都现取最新世界状态。用函数而不是值，避免闭包拿到过期的 state。 */
  getWorld: () => ToolContext;
  /** 把一句话排进语音队列。来自 useElenaVoice。 */
  enqueueSpeech: (text: string) => void;
  /** 打断她。 */
  stopSpeech: () => void;
  /** 切表情。 */
  setExpression: (e: ElenaExpression) => void;
}

/** 麦克风状态。没有本地引擎时永远停在 'unavailable'。 */
export type MicState = 'unavailable' | 'idle' | 'recording' | 'transcribing';

/** 把可接委托压成她读得懂、又不占太多 token 的一段。 */
function buildQuestBrief(world: ToolContext): string {
  if (world.quests.length === 0) return '（委托板现在是空的）';

  return world.quests
    .map((q) => {
      const flags = [
        world.user.level >= q.minLevel ? '等级够' : `要 ${q.minLevel} 级`,
        q.neededProfessions?.includes(world.user.profession) ? '点名了他的职业' : null,
        q.isUrgent ? '紧急' : null,
        world.activeQuestId === q.id ? '他正在做' : null,
      ].filter(Boolean);

      return `- [${q.id}] ${q.title}（${q.locationName}｜现实中是${q.realTask}｜${q.difficulty}｜约 ${q.estimatedTime} 分钟）${flags.length ? '｜' + flags.join('、') : ''}`;
    })
    .join('\n');
}

function buildContext(world: ToolContext): ElenaContext {
  const active = world.quests.find((q) => q.id === world.activeQuestId) ?? null;
  const now = new Date();
  const hour = now.getHours();
  const period =
    hour < 5 ? '凌晨' : hour < 11 ? '早上' : hour < 14 ? '中午' : hour < 18 ? '下午' : '晚上';

  return {
    name: world.user.name,
    race: world.user.race,
    profession: world.user.profession,
    realSkill: PROFESSION_CONFIG[world.user.profession].realSkill,
    level: world.user.level,
    goldCoins: world.user.goldCoins,
    activeQuestTitle: active?.title ?? null,
    questBrief: buildQuestBrief(world),
    localTime: `${period} ${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    hasLocation: world.userLocation !== null,
  };
}

/** 错误码 → 给玩家看的一句话。不把原始码丢到界面上。 */
function errorText(err: unknown): string {
  const code = err instanceof ApiError ? err.code : 'UNKNOWN';
  switch (code) {
    case 'AI_AUTH_FAILED':
      return '公会的通讯符还没启用（AI_AUTH_FAILED）。';
    case 'AI_RATE_LIMITED':
    case 'RATE_LIMITED':
      return '说得太快了，喘口气再来（限流）。';
    case 'AI_QUOTA_EXHAUSTED':
      return '通讯符的魔力用尽了（额度不足）。';
    case 'AI_CHAT_PATH_INVALID':
      return '对话接口地址不对，检查 MINIMAX_CHAT_PATH。';
    case 'AI_UNAVAILABLE':
      return '还没配置 MINIMAX_API_KEY。';
    default:
      return '通讯中断了，再说一次试试。';
  }
}

export function useElenaAgent({
  getWorld,
  enqueueSpeech,
  stopSpeech,
  setExpression,
}: ElenaAgentOptions) {
  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [micState, setMicState] = useState<MicState>(
    hasSttEngine() ? 'idle' : 'unavailable',
  );
  /** 语音输出开关。关掉后她只打字不出声，适合公共场合。 */
  const [voiceOn, setVoiceOn] = useState(true);

  const history = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const micAbort = useRef<AbortController | null>(null);

  const patchTurn = useCallback((id: string, patch: Partial<DisplayTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  /** 打断。玩家插话、关掉面板、或者她说跑题了，都走这里。 */
  const interrupt = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeech();
    setThinking(false);
    setTurns((prev) => prev.map((t) => (t.streaming ? { ...t, streaming: false } : t)));
  }, [stopSpeech]);

  /**
   * 跑一轮，必要时因为工具调用再跑下一轮。
   *
   * 流式文本一边显示一边切句送去合成，所以她开口的时间点取决于**第一句多长**，
   * 而不是整段生成完要多久。这是「活着」和「机器人」的分界线。
   */
  const runTurn = useCallback(
    async (turnId: string, round: number) => {
      if (round > MAX_TOOL_ROUNDS) {
        patchTurn(turnId, { streaming: false });
        return;
      }

      const world = getWorld();
      const controller = new AbortController();
      abortRef.current = controller;

      let head = '';                 // 表情标记还没解析出来时的缓冲
      let tagResolved = round > 0;   // 续轮不会再带标记
      let pending = '';              // 还没凑成一句的尾巴
      let full = '';                 // 完整回复，进历史用
      let tools: ToolCall[] = [];

      const emit = (chunk: string) => {
        full += chunk;
        pending += chunk;
        patchTurn(turnId, { text: full, streaming: true });

        const { ready, rest } = takeSentences(pending);
        if (ready) {
          pending = rest;
          if (voiceOn) enqueueSpeech(ready);
        }
      };

      try {
        await streamChat(
          trimHistory(history.current),
          buildContext(world),
          {
            onText: (delta) => {
              if (tagResolved) return emit(delta);

              // 还在等表情标记：先攒着，别让半个 "[expr:" 漏到界面上
              head += delta;
              if (!head.includes(']') && head.length < TAG_WINDOW) return;

              const { expression, rest } = parseExpressionTag(head);
              setExpression(expression);
              tagResolved = true;
              head = '';
              if (rest) emit(rest);
            },
            onTools: (calls) => {
              tools = calls;
            },
          },
          controller.signal,
        );
      } catch (err) {
        if (controller.signal.aborted) return; // 玩家打断，不是错误
        patchTurn(turnId, { text: full || errorText(err), streaming: false });
        setThinking(false);
        return;
      }

      // 标记之后一个字都没有（她只想调工具）——把攒的内容放出来，别吞了
      if (!tagResolved && head) {
        const { expression, rest } = parseExpressionTag(head);
        setExpression(expression);
        if (rest) emit(rest);
      }
      // 最后不足一句的尾巴也要说出来，否则结尾总是被截掉
      if (pending.trim() && voiceOn) enqueueSpeech(pending);

      if (tools.length === 0) {
        history.current.push({ role: 'assistant', content: full });
        patchTurn(turnId, { streaming: false });
        setThinking(false);
        return;
      }

      // ── 工具闭环 ──────────────────────────────────────
      history.current.push({ role: 'assistant', content: full || null, tool_calls: tools });

      const fresh = getWorld();
      const actions: string[] = [];
      for (const call of tools) {
        const result = executeTool(call.function.name, call.function.arguments, fresh);
        actions.push(describeAction(call.function.name, call.function.arguments));
        history.current.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, actions: [...t.actions, ...actions] } : t)),
      );

      await runTurn(turnId, round + 1);
    },
    [getWorld, patchTurn, enqueueSpeech, setExpression, voiceOn],
  );

  /** 说一句话给她听。 */
  const send = useCallback(
    async (text: string) => {
      const said = text.trim();
      if (!said || thinking) return;

      interrupt();
      setThinking(true);

      const turnId = crypto.randomUUID();
      history.current.push({ role: 'user', content: said });
      setTurns((prev) => [
        ...prev,
        { id: `${turnId}-p`, who: 'player', text: said, actions: [] },
        { id: turnId, who: 'elena', text: '', actions: [], streaming: true },
      ]);

      await runTurn(turnId, 0);
    },
    [thinking, interrupt, runTurn],
  );

  /* ── 麦克风 ────────────────────────────────────────────
   *
   * 录音归这里管，识别归 lib/agent/stt.ts 注册的本地引擎管。
   * 没注册引擎时 micState 恒为 'unavailable'，按钮禁用并标明原因，
   * 不去假装能用，也不偷偷退回任何云端识别。
   */

  const startListening = useCallback(async () => {
    if (!hasSttEngine() || micState !== 'idle') return;

    // 她还在说话时开麦 = 打断。真人对话就是这样。
    interrupt();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setMicState('transcribing');

        const controller = new AbortController();
        micAbort.current = controller;
        const said = await transcribe(new Blob(chunks, { type: rec.mimeType }), controller.signal);

        setMicState(hasSttEngine() ? 'idle' : 'unavailable');
        if (said) void send(said);
      };

      recorder.current = rec;
      rec.start();
      setMicState('recording');
    } catch (err) {
      console.error('[mic] 无法开启麦克风：', err);
      setMicState('idle');
    }
  }, [micState, interrupt, send]);

  const stopListening = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
  }, []);

  /** 清空对话。面板关掉时不清——她该记得刚才聊过什么。 */
  const reset = useCallback(() => {
    interrupt();
    history.current = [];
    setTurns([]);
  }, [interrupt]);

  return {
    turns,
    thinking,
    send,
    interrupt,
    reset,
    voiceOn,
    setVoiceOn,
    micState,
    micEngineName: sttEngineName(),
    startListening,
    stopListening,
  };
}
