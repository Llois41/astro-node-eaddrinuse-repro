# astro-node-eaddrinuse-repro

If its port is already taken, the `@astrojs/node` standalone server exits with code 0 and prints nothing.

## Versions

- `astro` 7.3.5, `@astrojs/node` 11.1.6 (`mode: 'standalone'`, `output: 'server'`)
- Node 26.10.0, pnpm 11.28.4; macOS arm64 and Linux (CI)

## Reproduce

```sh
pnpm install
pnpm build
pnpm repro
```

`repro.mjs` occupies an ephemeral port on `127.0.0.1` and starts `dist/server/entry.mjs` on it with `HOST`/`PORT`. Then it starts a plain `node:http` server on the same port for comparison:

```
--- @astrojs/node standalone (dist/server/entry.mjs)
exit code: 0
output: (none)

--- plain node:http on the same port
exit code: 1
output:
Error: listen EADDRINUSE: address already in use 127.0.0.1:…
```

Expected: the standalone server logs the `EADDRINUSE` error and exits non-zero.

## Cause

1. `createServer()` in `standalone.js` turns the server's `error` event into a rejection of the `closed` promise (`httpServer.addListener("error", reject)`). `standalone()` returns that promise as `done`, and `server.js` never handles it (`startServer();`).
2. `createAppHandler()` in `serve-app.js` registers a process-wide `unhandledRejection` listener. It only logs while a request is running, and returns silently otherwise. Registering any listener turns off Node's default (`--unhandled-rejections=throw`).

At boot no request is running, so the `EADDRINUSE` rejection is dropped. The server never gets a listen handle, the event loop empties, and the process exits 0. For the same reason, any other rejection outside a request is silently ignored for as long as the process runs.

Related: [#9133](https://github.com/withastro/astro/issues/9133) (closed, 2023) is about the same server and a port in use, but there the server claimed to be listening.
