import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server.ts';

// Express needs the raw request stream; Vercel's default body parser would
// consume it before express.json() can read it.
export const config = { api: { bodyParser: false } };

const appPromise = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  return (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
