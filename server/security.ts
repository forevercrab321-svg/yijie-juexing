/**
 * 平台无关的请求安全层。
 * 被 Cloudflare Pages Functions（生产）与 Vite dev 中间件（本地）共用。
 */

export interface Env {
  /** MiniMax API key。只存在于服务端，永不下发到浏览器。 */
  MINIMAX_API_KEY?: string;
  /**
   * MiniMax GroupId。账号维度的标识，与充值、计费、并发额度绑定。
   * Chat Completions 不需要它；T2A 在部分区域要求以查询参数形式带上。
   * 配置了就带，没配就不带。
   */
  MINIMAX_GROUP_ID?: string;
  /**
   * API 基地址。默认全球站 https://api.minimax.io。
   * 中国大陆账号需改为 https://api.minimaxi.chat；美西低延迟节点为 https://api-uw.minimax.io。
   */
  MINIMAX_BASE_URL?: string;
  /** TTS 音色。默认中文女声，可在不改代码的情况下替换。 */
  MINIMAX_TTS_VOICE_ID?: string;
  /** 逗号分隔的允许来源，例如 "https://aethelgard.app,https://www.aethelgard.app" */
  ALLOWED_ORIGINS?: string;
  /** 可选的 KV 命名空间绑定，用于跨实例限流。未绑定时降级为单实例内存限流。 */
  RATE_LIMIT_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  };
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
];

/**
 * 拒绝跨站调用，避免 API key 被第三方站点当成免费网关。
 * 同源请求（浏览器不带 Origin 的 GET/导航）不适用于本代理，所有端点均为 POST。
 */
export function assertAllowedOrigin(request: Request, env: Env): void {
  const origin = request.headers.get('Origin');
  if (!origin) {
    // fetch() 的同源 POST 在部分浏览器下不带 Origin，此时退回 Referer 判断。
    const referer = request.headers.get('Referer');
    if (!referer) throw new HttpError(403, 'ORIGIN_REQUIRED');
    if (!isAllowed(new URL(referer).origin, env)) throw new HttpError(403, 'ORIGIN_DENIED');
    return;
  }
  if (!isAllowed(origin, env)) throw new HttpError(403, 'ORIGIN_DENIED');
}

function isAllowed(origin: string, env: Env): boolean {
  const configured = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowList = configured.length > 0 ? configured : DEV_ORIGINS;
  return allowList.includes(origin);
}

/** 客户端 IP。CF 用 CF-Connecting-IP，本地退回占位符。 */
export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    'local'
  );
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

/**
 * 固定窗口限流。KV 绑定存在时跨实例生效，否则退回单实例内存桶。
 * 内存模式在多实例部署下会漏算，仅适用于本地开发与单实例场景。
 */
export async function enforceRateLimit(
  env: Env,
  bucket: string,
  ip: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const key = `rl:${bucket}:${ip}`;

  if (env.RATE_LIMIT_KV) {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= limit) throw new HttpError(429, 'RATE_LIMITED');
    await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: windowSeconds });
    return;
  }

  const now = Date.now();
  const entry = memoryBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return;
  }
  if (entry.count >= limit) throw new HttpError(429, 'RATE_LIMITED');
  entry.count += 1;
}

/** 读取并限制请求体大小，避免超大 payload 打爆上游配额。 */
export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  const declared = request.headers.get('Content-Length');
  if (declared && parseInt(declared, 10) > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * 统一错误出口。上游错误详情只写服务端日志，客户端仅收到错误码，
 * 避免把 API key、配额信息、上游 URL 之类的内容回显给浏览器。
 */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return jsonResponse({ error: err.code }, err.status);
  }
  console.error('[api] unhandled error:', err);
  return jsonResponse({ error: 'INTERNAL_ERROR' }, 500);
}
