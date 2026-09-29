import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
const runtimeOnly = process.argv.includes('--runtime-only');
const root = new URL(runtimeOnly ? '../public/' : '../dist/browser/', import.meta.url);
const require = createRequire(import.meta.url);
const transformersRequire = createRequire(require.resolve('@huggingface/transformers'));
const ort = dirname(transformersRequire.resolve('onnxruntime-web'));
await mkdir(new URL('onnx/', root), { recursive: true });
for (const file of await readdir(ort)) {
  if (file.endsWith('.wasm') || file.endsWith('.mjs'))
    await copyFile(join(ort, file), new URL('onnx/' + file, root));
}
if (runtimeOnly) process.exit(0);
async function files(url, prefix = '') {
  const result = [];
  for (const entry of await readdir(url, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory())
      result.push(...(await files(new URL(entry.name + '/', url), path + '/')));
    else if (!path.endsWith('.map') && path !== 'sw.js') result.push('/' + path);
  }
  return result;
}
const assets = await files(root);
const hash = createHash('sha256');
for (const path of assets) hash.update(await readFile(new URL('.' + path, root)));
const version = 'devcraft-rag-' + hash.digest('hex').slice(0, 12);
await writeFile(
  new URL('sw.js', root),
  `
const CACHE=${JSON.stringify(version)};
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('devcraft-rag-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const key=event.request.mode==='navigate'?'/index.html':new URL(event.request.url).pathname;
    return (await cache.match(key))||fetch(event.request);
  }));
});
`,
);
console.log(
  `Prepared offline app shell: ${assets.length} files. Models use the Transformers browser cache.`,
);
