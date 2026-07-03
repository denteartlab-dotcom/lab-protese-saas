/**
 * Garante AsyncLocalStorage real antes do Next compilar o middleware (Edge).
 * Sem isso, o cache CJS de async-local-storage.js pode ficar com FakeALS e
 * cookies()/headers() quebram no servidor customizado (Next 15 + Windows).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import path from "node:path";

const g = globalThis as typeof globalThis & {
  AsyncLocalStorage?: typeof AsyncLocalStorage;
};

if (!g.AsyncLocalStorage) {
  g.AsyncLocalStorage = AsyncLocalStorage;
}

const requireNext = createRequire(path.join(process.cwd(), "package.json"));
requireNext("next/dist/server/app-render/async-local-storage.js");
