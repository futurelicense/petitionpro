import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Use the app's actual storage adapters so migration keeps idempotency and
// attachment handling identical to the production request path.
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
for (const name of ['.env.local', '.env']) {
  try { process.loadEnvFile(resolve(root, name)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const cache = new Map();
export function loadServerModule(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports, process, Buffer, URL, Headers, AbortSignal, fetch,
    require: name => name === 'server-only' ? {} : name.startsWith('.') ? loadServerModule(resolve(dirname(file), `${name}.ts`)) : require(name),
  }, { filename: file });
  return exports;
}
