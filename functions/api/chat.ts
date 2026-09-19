import { handleChat } from '../../server/chat';
import { errorResponse, type Env } from '../../server/security';

/** Cloudflare Pages Function 适配层：POST /api/chat（SSE 流式） */
export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    return await handleChat(context.request, context.env);
  } catch (err) {
    return errorResponse(err);
  }
};
