import path from 'path';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * 本地开发用的 /api 中间件。
 *
 * 生产环境由 functions/api/*.ts（Cloudflare Pages Functions）提供同样的端点，
 * 两边共用 server/ai.ts 里的同一份 handler，避免出现"本地能跑、线上不一样"的分叉。
 * 通过 ssrLoadModule 动态加载，改 handler 时不需要重启 dev server。
 */
function devApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'dev-api-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/api/')) return next();

        try {
          const mod = await server.ssrLoadModule('/server/ai.ts');
          const security = await server.ssrLoadModule('/server/security.ts');
          const handler = mod.API_ROUTES[url];

          if (!handler) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'NOT_FOUND' }));
            return;
          }
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
            return;
          }

          const request = await toWebRequest(req, url);
          let response: Response;
          try {
            response = await handler(request, {
              MINIMAX_API_KEY: env.MINIMAX_API_KEY,
              MINIMAX_GROUP_ID: env.MINIMAX_GROUP_ID,
              MINIMAX_BASE_URL: env.MINIMAX_BASE_URL,
              MINIMAX_TTS_VOICE_ID: env.MINIMAX_TTS_VOICE_ID,
              ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
            });
          } catch (err) {
            response = security.errorResponse(err);
          }

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          console.error('[dev-api] 中间件异常:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'INTERNAL_ERROR' }));
        }
      });
    },
  };
}

/** 把 Node 的 IncomingMessage 转成 Web 标准 Request，让 handler 保持平台无关。 */
async function toWebRequest(req: IncomingMessage, url: string): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }

  return new Request(`http://localhost${url}`, {
    method: req.method,
    headers,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), devApiPlugin(env)],
    // 注意：这里刻意不再用 define 注入 GEMINI_API_KEY。
    // define 会把 key 明文编译进前端 bundle，任何访问者都能从 JS 里读出来。
    // 所有模型调用一律经过 /api/* 服务端代理。
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
