/**
 * MiniMax 服务端代理。
 *
 * 目前只有一个用途：合成艾琳娜的语音。
 *
 * 相貌改为从现成图库随机抽取后，视觉分析与图像生成端点已整个移除——
 * 应用不再向任何模型发送用户数据，也不再采集生物特征。
 *
 * 安全前提：API key 只在这一层出现。浏览器永远只看到 /api/* 的响应，
 * 拿不到 key，也无法用任意 prompt 驱动模型——人设固定在服务端。
 */

import { buildSpeechInstruction } from '../lib/elena';
import {
  Env,
  HttpError,
  assertAllowedOrigin,
  clientIp,
  enforceRateLimit,
  jsonResponse,
  readJsonBody,
} from './security';

const DEFAULT_BASE_URL = 'https://api.minimax.io';

/** TTS 模型。hd 音质更好，turbo 更快更便宜。 */
const TTS_MODEL = 'speech-2.6-hd';
const DEFAULT_VOICE_ID = 'Chinese (Mandarin)_Lyrical_Voice';

const TTS_MAX_CHARS = 300;

function baseUrl(env: Env): string {
  return (env.MINIMAX_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/**
 * MiniMax 的失败不一定体现在 HTTP 状态码上——鉴权失败(1004)、限流(1002)、
 * 余额不足(1008)都可能以 HTTP 200 + base_resp.status_code != 0 的形式返回。
 * 只看 res.ok 会把这些当成功处理，拿到一个没有音频的空响应。
 */
function assertUpstreamOk(data: any, label: string): void {
  const code = data?.base_resp?.status_code;
  if (code !== undefined && code !== 0) {
    // status_msg 可能包含账号/配额信息，只落服务端日志
    console.error(`[api] MiniMax ${label} base_resp ${code}: ${data?.base_resp?.status_msg}`);
    if (code === 1004 || code === 2049) throw new HttpError(503, 'AI_AUTH_FAILED');
    if (code === 1002) throw new HttpError(429, 'AI_RATE_LIMITED');
    if (code === 1008) throw new HttpError(503, 'AI_QUOTA_EXHAUSTED');
    throw new HttpError(502, 'AI_UPSTREAM_ERROR');
  }
}

async function callMiniMax(
  env: Env,
  path: string,
  payload: unknown,
  label: string,
  withGroupId = false,
): Promise<any> {
  if (!env.MINIMAX_API_KEY) {
    console.error('[api] MINIMAX_API_KEY 未配置');
    throw new HttpError(503, 'AI_UNAVAILABLE');
  }

  let url = `${baseUrl(env)}${path}`;
  if (withGroupId && env.MINIMAX_GROUP_ID) {
    url += `?GroupId=${encodeURIComponent(env.MINIMAX_GROUP_ID)}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // 上游错误正文可能包含配额、账号 ID 等信息，只落服务端日志
    console.error(`[api] MiniMax ${label} HTTP ${res.status}:`, await res.text());
    if (res.status === 401 || res.status === 403) throw new HttpError(503, 'AI_AUTH_FAILED');
    if (res.status === 429) throw new HttpError(429, 'AI_RATE_LIMITED');
    throw new HttpError(502, 'AI_UPSTREAM_ERROR');
  }

  const data = await res.json();
  assertUpstreamOk(data, label);
  return data;
}

/** hex → base64。T2A 返回十六进制字符串，直接下发会让传输体积翻倍。 */
function hexToBase64(hex: string): string {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new HttpError(502, 'AI_MALFORMED_RESPONSE');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  let binary = '';
  const CHUNK = 0x8000; // 分块，避免超长参数列表爆栈
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * POST /api/tts
 * 入参 { text }，出参 { audioBase64, mimeType }。
 *
 * 只接受纯台词文本，长度受限，人设由服务端注入。
 * 固定台词已在 public/audio/elena/ 预生成，这个端点只服务于含动态内容的语音。
 */
export async function handleTts(request: Request, env: Env): Promise<Response> {
  assertAllowedOrigin(request, env);
  await enforceRateLimit(env, 'tts', clientIp(request), 30, 60);

  const body = await readJsonBody<{ text?: unknown }>(request, 8_000);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new HttpError(400, 'TEXT_REQUIRED');
  if (text.length > TTS_MAX_CHARS) throw new HttpError(400, 'TEXT_TOO_LONG');

  const data = await callMiniMax(
    env,
    '/v1/t2a_v2',
    {
      model: TTS_MODEL,
      // 朗读指令与角色设定同源（lib/elena.ts），
      // 保证实时合成的音色与预生成音频听起来是同一个人。
      // 人设固定在服务端，客户端无法替换，避免把代理当通用 TTS 使用。
      text: buildSpeechInstruction(text),
      stream: false,
      // hex 是默认值，这里显式写出来，避免上游改默认值时静默换成 url 形态
      output_format: 'hex',
      voice_setting: {
        voice_id: env.MINIMAX_TTS_VOICE_ID || DEFAULT_VOICE_ID,
        speed: 1.0,
        vol: 1.0,
        pitch: 0,
        emotion: 'calm',
      },
      // mp3 让浏览器可以直接用 decodeAudioData 解码，不必手工拼 PCM 帧
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
      language_boost: 'Chinese',
    },
    't2a',
    true,
  );

  const hex: string | undefined = data?.data?.audio;
  if (!hex) throw new HttpError(502, 'AI_EMPTY_RESPONSE');

  return jsonResponse({ audioBase64: hexToBase64(hex), mimeType: 'audio/mpeg' });
}

/** 路由表。dev 中间件与 Pages Functions 共用同一份实现。 */
export const API_ROUTES: Record<string, (req: Request, env: Env) => Promise<Response>> = {
  '/api/tts': handleTts,
};
