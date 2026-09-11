import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const url = specifier.startsWith('@/')
        ? new URL(specifier.slice(2), root)
        : new URL(specifier, context.parentURL);
      const path = fileURLToPath(url);
      if (!existsSync(path)) {
        for (const suffix of ['.ts', '/index.ts']) {
          if (existsSync(path + suffix)) return nextResolve(pathToFileURL(path + suffix).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
