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

