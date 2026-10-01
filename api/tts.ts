import { handleTts } from '../server/ai';
import { errorResponse, type Env } from '../server/security';

/**
 * Vercel Function 适配层：POST /api/tts
 *
 * 与 functions/api/tts.ts（Cloudflare）共用同一份 handler，只是取环境变量的方式不同——
 * Cloudflare 把 env 作为参数传进来，Vercel 放在 process.env 上。
 */
function envFromProcess(): Env {
  return {
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID,
    MINIMAX_BASE_URL: process.env.MINIMAX_BASE_URL,
    MINIMAX_TTS_VOICE_ID: process.env.MINIMAX_TTS_VOICE_ID,
    MINIMAX_TTS_MODEL: process.env.MINIMAX_TTS_MODEL,
    MINIMAX_CHAT_MODEL: process.env.MINIMAX_CHAT_MODEL,
    MINIMAX_CHAT_PATH: process.env.MINIMAX_CHAT_PATH,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleTts(request, envFromProcess());
  } catch (err) {
    return errorResponse(err);
  }
}
