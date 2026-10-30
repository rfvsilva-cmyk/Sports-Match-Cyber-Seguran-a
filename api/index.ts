import { createNestApp } from '../src/bootstrap';

let serverPromise: Promise<any> | undefined;

function getServer() {
  if (!serverPromise) {
    serverPromise = (async () => {
      const app = await createNestApp();
      await app.init();
      return app.getHttpAdapter().getInstance();
    })();
  }

  return serverPromise;
}

export default async function handler(req: any, res: any) {
  try {
    const server = await getServer();

    // A Vercel mantém a URL original mesmo após o rewrite para /api/index.
    // As rotas Nest não têm o prefixo /api, então removemos somente esse prefixo.
    if (typeof req.url === 'string' && (req.url === '/api' || req.url.startsWith('/api/'))) {
      req.url = req.url.replace(/^\/api/, '') || '/';
    }

    server(req, res);

    await new Promise<void>((resolve) => {
      if (res.writableEnded) {
        resolve();
        return;
      }

      res.once('finish', resolve);
      res.once('close', resolve);
      res.once('error', resolve);
    });
  } catch (error: any) {
    console.error('Vercel Handler Error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        message: 'Internal Server Error',
        error: error?.message || 'Unknown error',
      });
      return;
    }

    res.end();
  }
}
