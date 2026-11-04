// Isolated integration-test server; never uses production Redis or real wallet keys.
import next from 'next';
import { createServer } from 'node:http';

async function main() {
  const port = Number(process.env.TEST_PORT);
  const app = next({ dev: true, dir: process.cwd(), hostname: '127.0.0.1', port });
  await app.prepare();
  const handler = app.getRequestHandler();
  createServer((req, res) => handler(req, res)).listen(port, '127.0.0.1', () => console.log('TEST_SERVER_READY'));
}
main().catch(() => { console.error('Integration server failed.'); process.exit(1); });
