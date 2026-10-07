// Occupies a port, starts the built standalone server on it, and reports how it
// ended. Then does the same with a plain node:http server for comparison.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const HOST = '127.0.0.1';

function occupy() {
  return new Promise((resolve) => {
    const blocker = createServer();
    blocker.listen(0, HOST, () => resolve(blocker));
  });
}

function run(label, args, port) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, HOST, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      console.log(`--- ${label}`);
      console.log(`exit code: ${code}${signal ? ` (killed: ${signal})` : ''}`);
      console.log(`output: ${output.trim() === '' ? '(none)' : `\n${output.trim()}`}\n`);
      resolve();
    });
  });
}

const blocker = await occupy();
const { port } = blocker.address();
console.log(`port ${port} is taken\n`);

await run('@astrojs/node standalone (dist/server/entry.mjs)', ['dist/server/entry.mjs'], port);
await run(
  'plain node:http on the same port',
  ['-e', `require('node:http').createServer().listen(${port}, '${HOST}')`],
  port,
);

blocker.close();
