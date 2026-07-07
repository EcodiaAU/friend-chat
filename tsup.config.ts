import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'framer-motion'],
  // Copy the stylesheet verbatim into dist; consumers import '@ecodia/friend-chat/styles.css'.
  onSuccess: 'cp src/styles.css dist/styles.css',
});
