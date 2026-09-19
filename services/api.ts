/**
 * 前端唯一的 AI 调用入口。
 *
 * 这里没有、也不会有 API key——所有模型调用都打到同源的 /api/*，
 * 由服务端持有凭据并注入人设。
 *
 * 目前只剩语音合成。相貌改为从现成图库随机抽取后，
 * 应用不再向任何模型发送用户数据。
 */

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let code = 'REQUEST_FAILED';
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      /* 响应不是 JSON，沿用默认错误码 */
    }
    throw new ApiError(code, res.status);
  }
  return res.json() as Promise<T>;
}

export interface TtsResult {
  /** base64 编码的音频文件（服务端已把上游的 hex 转过来） */
  audioBase64: string;
  /** 目前固定为 audio/mpeg，交给 decodeAudioData 处理 */
  mimeType: string;
}

/** 合成艾琳娜的语音。人设固定在服务端，这里只传台词。 */
export function synthesizeVoice(text: string): Promise<TtsResult> {
  return postJson<TtsResult>('/api/tts', { text });
}


/* ── 艾琳娜的对话 ────────────────────────────────────────── */

import type { ChatMessage, ToolCall } from '../lib/agent/conversation';
import type { ElenaContext } from '../lib/elena';

export interface ChatHandlers {
  /** 文本增量。来一个字给一个字，界面与切句都靠它驱动。 */
  onText: (delta: string) => void;
  /** 这一轮她要调的工具。执行完把结果塞回 messages 再调一次 streamChat。 */
  onTools: (calls: ToolCall[]) => void;
}

/**
 * 与艾琳娜对话。SSE 流式。
 *
 * 人设、工具定义、system prompt 全在服务端组装，这里只负责传历史与上下文。
 *
 * @param signal 玩家打断她时 abort。会一并取消上游请求，不再继续计费。
 * @throws ApiError 建立连接阶段的失败；流中途的失败走 onText 之后的 error 事件，
 *                  同样以 ApiError 抛出，让调用方只需要一个 catch。
 */
export async function streamChat(
  messages: ChatMessage[],
  context: ElenaContext,
  handlers: ChatHandlers,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
    signal,
  });

  if (!res.ok || !res.body) {
    let code = 'REQUEST_FAILED';
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      /* 响应不是 JSON，沿用默认错误码 */
    }
    throw new ApiError(code, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 事件之间空行分隔；最后一段可能只收到一半，留着等下一片
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const line = event.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;

        let msg: { t: string; v?: unknown };
        try {
          msg = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }

        if (msg.t === 'text') handlers.onText(String(msg.v ?? ''));
        else if (msg.t === 'tools') handlers.onTools((msg.v as ToolCall[]) ?? []);
        else if (msg.t === 'error') throw new ApiError(String(msg.v ?? 'AI_UPSTREAM_ERROR'), 502);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
