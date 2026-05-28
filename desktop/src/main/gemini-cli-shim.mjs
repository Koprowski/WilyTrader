import { pathToFileURL } from 'node:url';

const bundlePath = process.argv[2];
if (!bundlePath) {
  console.error('[wilytrader/gemini-cli-shim] missing bundle path argument');
  process.exit(2);
}

Object.defineProperty(process, 'defaultApp', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: true,
});

process.argv.splice(1, 1);
await import(pathToFileURL(bundlePath).href);
