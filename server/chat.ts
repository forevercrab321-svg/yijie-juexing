/**
 * POST /api/chat —— 艾琳娜的大脑。
 *
 * 与 /api/tts 同样的安全前提：API key 只在这一层出现，**人设固定在服务端**。
 * 客户端传的只有对话历史和一份运行时上下文（等级、当前委托、时间），
 * system prompt 由服务端用 lib/elena.ts 现场组装——
 * 客户端既换不掉她的性格，也没法把这个端点当通用聊天网关用。
 *
 * ── 流式与工具的分工 ──────────────────────────────────────
 *
 * 这个端点**不执行任何工具**，只把模型吐出的 tool_calls 原样转发给前端。
 * 理由很实际：工具要动 React state、动地图、改本机档案，这些都不在服务端。
 * 前端执行完把结果塞回 messages 里再请求一次，形成闭环。
 *
 * 输出是 SSE，每行一个 JSON：
 *   {"t":"text","v":"..."}    文本增量，来一个字发一个字
 *   {"t":"tools","v":[...]}   这一轮她要调的工具，一次性给全
 *   {"t":"done"}              这一轮结束
 *   {"t":"error","v":"CODE"}  出错，错误码与 /api/tts 同一套
 */

import { buildSystemPrompt, type ElenaContext } from '../lib/elena';
import { ELENA_TOOLS } from '../lib/agent/tool-schema';
import {
  Env,
  HttpError,
  assertAllowedOrigin,
  clientIp,
  enforceRateLimit,
  readJsonBody,
} from './security';

const DEFAULT_BASE_URL = 'https://api.minimax.io';

/**
 * 对话模型。
 *
 * ⚠️ 这个值必须与你账号里实际可用的模型对上，不对会收到上游 400。
 * MiniMax 的模型名随版本变动，所以做成环境变量而不是写死在代码里。
 */
const DEFAULT_CHAT_MODEL = 'MiniMax-M2.7';

/**
 * 对话接口路径。
 *
 * MiniMax 同时提供原生路径与 OpenAI 兼容路径，不同账号/区域开通情况不一样。
 * 两条路都吃同一份请求体（messages + tools + stream），所以做成可切换的：
 *   原生        /v1/text/chatcompletion_v2   ← 默认
 *   OpenAI 兼容  /v1/chat/completions
 * 收到 404 或 path not found 就把 MINIMAX_CHAT_PATH 换成另一条。
 */
const DEFAULT_CHAT_PATH = '/v1/text/chatcompletion_v2';

/** 她一次最多说这么多。人设要求三句以内，留足余量即可，防的是失控长输出烧额度。 */
const MAX_OUTPUT_TOKENS = 512;

/** 历史上限。超过就是客户端没做裁剪，直接拒绝而不是默默截断。 */
const MAX_MESSAGES = 32;
const MAX_CONTENT_CHARS = 4_000;

interface ChatRequestBody {
  messages?: unknown;
  context?: unknown;
}

function baseUrl(env: Env): string {
  return (env.MINIMAX_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/**
 * 校验并收窄客户端传来的消息。
 *
 * 明确剔除 role='system'：允许客户端塞 system 就等于把人设交出去了。
 */
function sanitizeMessages(raw: unknown): any[] {
  if (!Array.isArray(raw)) throw new HttpError(400, 'MESSAGES_REQUIRED');
  if (raw.length === 0) throw new HttpError(400, 'MESSAGES_REQUIRED');
  if (raw.length > MAX_MESSAGES) throw new HttpError(400, 'HISTORY_TOO_LONG');

  return raw.map((m: any) => {
    const role = m?.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'tool') {
      throw new HttpError(400, 'INVALID_ROLE');
    }
    const content = typeof m?.content === 'string' ? m.content : null;
    if (content && content.length > MAX_CONTENT_CHARS) {
      throw new HttpError(400, 'CONTENT_TOO_LONG');
    }

    const out: any = { role, content };
    if (role === 'tool') {
      if (typeof m.tool_call_id !== 'string') throw new HttpError(400, 'TOOL_CALL_ID_REQUIRED');
      out.tool_call_id = m.tool_call_id;
    }
    if (role === 'assistant' && Array.isArray(m.tool_calls)) {
      out.tool_calls = m.tool_calls;
    }
    return out;
  });
}

/** 上下文只取需要的字段，多余的一律丢掉，不让客户端往提示词里夹带内容。 */
function sanitizeContext(raw: unknown): ElenaContext {
  const c = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fallback = '') =>
    typeof v === 'string' ? v.slice(0, 400) : fallback;
  const num = (v: unknown, fallback = 0) => (typeof v === 'number' && isFinite(v) ? v : fallback);

  return {
    name: str(c.name, '冒险者'),
    race: str(c.race, '未知'),
    profession: str(c.profession, '未知'),
    realSkill: str(c.realSkill, '未知'),
    level: num(c.level, 1),
    goldCoins: num(c.goldCoins, 0),
    activeQuestTitle: typeof c.activeQuestTitle === 'string' ? str(c.activeQuestTitle) : null,
    questBrief: typeof c.questBrief === 'string' ? c.questBrief.slice(0, 4_000) : '（暂无）',
    localTime: str(c.localTime, '未知'),
    hasLocation: Boolean(c.hasLocation),
  };
}

/** 一条 SSE 行。 */
function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/**
 * 累积流式 tool_calls。
 *
 * 上游把一次函数调用拆成多个 delta 发：第一个带 id 和函数名，
 * 后面几个只带 arguments 的碎片，靠 index 对应到同一次调用。
 * 不按 index 合并的话，参数会散成好几段无法解析的 JSON。
 */
type PartialCall = { id: string; name: string; args: string };

function mergeToolCallDeltas(acc: Map<number, PartialCall>, deltas: any[]): void {
  for (const d of deltas) {
    const idx = typeof d?.index === 'number' ? d.index : 0;
    const cur = acc.get(idx) ?? { id: '', name: '', args: '' };
    if (d?.id) cur.id = d.id;
    if (d?.function?.name) cur.name = d.function.name;
    if (d?.function?.arguments) cur.args += d.function.arguments;
    acc.set(idx, cur);
  }
}

export async function handleChat(request: Request, env: Env): Promise<Response> {
  assertAllowedOrigin(request, env);
  // 语音对话轮次比打字密集，但也不该密集到这个程度——超过就是脚本在刷
  await enforceRateLimit(env, 'chat', clientIp(request), 20, 60);

  if (!env.MINIMAX_API_KEY) {
    console.error('[api] MINIMAX_API_KEY 未配置');
    throw new HttpError(503, 'AI_UNAVAILABLE');
  }

  const body = await readJsonBody<ChatRequestBody>(request, 64_000);
  const messages = sanitizeMessages(body.messages);
  const context = sanitizeContext(body.context);

  // 工具定义在服务端拼，和人设一样不接受客户端覆盖。

  const path = env.MINIMAX_CHAT_PATH || DEFAULT_CHAT_PATH;
  let url = `${baseUrl(env)}${path}`;
  if (env.MINIMAX_GROUP_ID) url += `?GroupId=${encodeURIComponent(env.MINIMAX_GROUP_ID)}`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.MINIMAX_CHAT_MODEL || DEFAULT_CHAT_MODEL,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      // 柜台对话要稳定，但完全不随机会显得像录音。0.7 是能保持人味又不跑题的位置。
      temperature: 0.7,
      tools: ELENA_TOOLS,
      tool_choice: 'auto',
      messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    // 上游错误正文可能含配额、账号信息，只落服务端日志
    console.error(
      `[api] MiniMax chat HTTP ${upstream.status}:`,
      await upstream.text().catch(() => '<无正文>'),
    );
    if (upstream.status === 401 || upstream.status === 403) throw new HttpError(503, 'AI_AUTH_FAILED');
    if (upstream.status === 429) throw new HttpError(429, 'AI_RATE_LIMITED');
    if (upstream.status === 404) throw new HttpError(502, 'AI_CHAT_PATH_INVALID');
    throw new HttpError(502, 'AI_UPSTREAM_ERROR');
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const calls = new Map<number, PartialCall>();
      let buffer = '';
      let sawAnything = false;

      const push = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE 以空行分隔事件；最后一段可能不完整，留在 buffer 里等下一片
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const event of events) {
            const line = event.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;

            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            let chunk: any;
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue; // 半截 JSON，丢掉即可，下一片会补上
            }

            // HTTP 200 不代表成功：鉴权失败(1004)、限流(1002)、余额不足(1008)
            // 都会以 200 + base_resp.status_code != 0 的形式混在流里。
            const code = chunk?.base_resp?.status_code;
            if (code !== undefined && code !== 0) {
              console.error(`[api] MiniMax chat base_resp ${code}: ${chunk?.base_resp?.status_msg}`);
              push({
                t: 'error',
                v:
                  code === 1004 || code === 2049
                    ? 'AI_AUTH_FAILED'
                    : code === 1002
                      ? 'AI_RATE_LIMITED'
                      : code === 1008
                        ? 'AI_QUOTA_EXHAUSTED'
                        : 'AI_UPSTREAM_ERROR',
              });
              controller.close();
              return;
            }

            const delta = chunk?.choices?.[0]?.delta;
            if (!delta) continue;

            if (typeof delta.content === 'string' && delta.content.length > 0) {
              sawAnything = true;
              push({ t: 'text', v: delta.content });
            }
            if (Array.isArray(delta.tool_calls)) {
              sawAnything = true;
              mergeToolCallDeltas(calls, delta.tool_calls);
            }
          }
        }

        if (calls.size > 0) {
          push({
            t: 'tools',
            v: [...calls.entries()]
              .sort(([a], [b]) => a - b)
              .map(([, c], i) => ({
                // 上游偶尔不给 id，自己补一个——tool 结果必须能对回去
                id: c.id || `call_${i}`,
                type: 'function',
                function: { name: c.name, arguments: c.args || '{}' },
              })),
          });
        }
        if (!sawAnything) push({ t: 'error', v: 'AI_EMPTY_RESPONSE' });
        push({ t: 'done' });
      } catch (err) {
        console.error('[api] chat 流中断:', err);
        push({ t: 'error', v: 'AI_STREAM_INTERRUPTED' });
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },

    cancel() {
      // 玩家打断她时前端会 abort，这里要把上游也断掉，否则剩下的 token 照样计费
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // 某些反代会缓冲 SSE，缓冲了就不是流式了
      'X-Accel-Buffering': 'no',
    },
  });
}
