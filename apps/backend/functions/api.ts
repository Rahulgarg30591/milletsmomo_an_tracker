import { app } from '@azure/functions';
import expressApp from '../src/app.js';

app.http('api', {
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  authLevel: 'anonymous',
  route: '{*proxy}',
  handler: async (_context, req) => {
    return new Promise((resolve) => {
      const resBody: { status: number; body: any; headers: Record<string, string> } = {
        status: 200,
        body: null,
        headers: {},
      };

      const mockRes = {
        statusCode: 200,
        status: (code: number) => {
          resBody.status = code;
          return mockRes;
        },
        set: (key: string, value: string) => {
          resBody.headers[key] = value;
          return mockRes;
        },
        json: (body: any) => {
          resBody.body = body;
          resBody.headers['Content-Type'] = 'application/json';
          resolve({
            status: resBody.status,
            body: resBody.body,
            headers: { ...resBody.headers, ...resBody.headers },
          } as any);
        },
        send: (body: any) => {
          resBody.body = body;
          resolve({
            status: resBody.status,
            body: resBody.body,
          } as any);
        },
        end: () => {
          resolve({
            status: resBody.status,
            body: resBody.body,
          } as any);
        },
      };

      expressApp(req as any, mockRes as any, () => {
        resolve({
          status: resBody.status,
          body: resBody.body,
        } as any);
      });
    });
  },
});