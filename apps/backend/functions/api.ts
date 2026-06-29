import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import expressApp from '../src/app.js';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

async function azureToExpressReq(azureReq: HttpRequest): Promise<IncomingMessage> {
  const url = new URL(azureReq.url);
  const socket = new Socket({ readable: false });

  const req = new IncomingMessage(socket);
  req.method = azureReq.method;
  req.url = url.pathname + url.search;

  const headers: Record<string, string | string[]> = {};
  azureReq.headers.forEach((value, key) => {
    headers[key] = value;
  });
  req.headers = headers;

  let parsedBody: any = undefined;
  if (azureReq.bodyUsed || azureReq.body) {
    try {
      parsedBody = await azureReq.json();
    } catch {
      try {
        parsedBody = await azureReq.text();
      } catch {
        parsedBody = null;
      }
    }
  }

  (req as any).body = parsedBody;
  delete (req.headers as any)['content-type'];
  delete (req.headers as any)['content-length'];
  delete (req.headers as any)['transfer-encoding'];
  (req as any).query = Object.fromEntries(azureReq.query.entries());
  (req as any).ip = (azureReq.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
    || azureReq.headers.get('x-client-ip')
    || '127.0.0.1';
  (req as any).protocol = url.protocol.replace(':', '');
  (req as any).secure = (req as any).protocol === 'https';
  (req as any).hostname = url.hostname;
  (req as any).originalUrl = req.url;
  (req as any).path = url.pathname;
  (req as any).get = (name: string) => {
    const h = req.headers[name.toLowerCase()];
    if (Array.isArray(h)) return h.join(', ');
    return h || undefined;
  };

  return req;
}

app.http('api', {
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: '{*proxy}',
  handler: async (azureReq: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const req = await azureToExpressReq(azureReq);

    return new Promise((resolve) => {
      const res = new ServerResponse(req);
      let ended = false;
      const bodyChunks: Buffer[] = [];

      const finish = () => {
        if (ended) return;
        ended = true;

        const bodyBuf = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : Buffer.alloc(0);
        const bodyStr = bodyBuf.toString('utf-8');

        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.getHeaders())) {
          if (value !== undefined) {
            headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
          }
        }

        resolve({
          status: res.statusCode || 200,
          headers,
          body: bodyStr || null,
        });
      };

      res.write = (chunk: any): boolean => {
        if (chunk != null) {
          bodyChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        return true;
      };

      res.end = (chunk: any): ServerResponse => {
        if (chunk != null) {
          bodyChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        finish();
        return res;
      };

      (res as any).writeHead = (statusCode: number, statusMessageOrHeaders?: string | Record<string, string>, maybeHeaders?: Record<string, string>): ServerResponse => {
        res.statusCode = statusCode;
        let hdrs: Record<string, string> | undefined;
        if (typeof statusMessageOrHeaders === 'object') {
          hdrs = statusMessageOrHeaders;
        }
        if (maybeHeaders && typeof maybeHeaders === 'object') {
          hdrs = maybeHeaders;
        }
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            res.setHeader(k, v);
          }
        }
        return res;
      };

      expressApp(req as any, res as any, () => {
        finish();
      });
    });
  },
});
