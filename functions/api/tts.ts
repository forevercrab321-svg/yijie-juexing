import { handleTts } from '../../server/ai';
import { errorResponse, type Env } from '../../server/security';

/** Cloudflare Pages Function 适配层：POST /api/tts */
export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    return await handleTts(context.request, context.env);
  } catch (err) {
    return errorResponse(err);
  }
};
