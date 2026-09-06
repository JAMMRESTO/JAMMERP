import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

function buildVersionPlugin() {
  return {
    name: 'build-version',
    buildStart() {
      const version = Date.now().toString(36);
      writeFileSync(
        resolve(__dirname, 'public/build-version.json'),
        JSON.stringify({ v: version, t: Date.now() })
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), buildVersionPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
