import { defineConfig, type Plugin } from 'vitest/config';

// Strip references to parent-site shared assets (../styles.css, ../aurora.js, etc.)
// from canvas.html during dev/build. This keeps M1 tooling self-contained; M7 will
// replace this with a real solution (copy into public/shared/ or host via parent site).
function stripParentAssets(): Plugin {
  return {
    name: 'strip-parent-assets',
    transformIndexHtml(html) {
      return html
        .replace(/\n?\s*<link[^>]*href=["']\.\.\/[^"']*["'][^>]*>/g, '')
        .replace(/\n?\s*<script[^>]*src=["']\.\.\/[^"']*["'][^>]*>\s*<\/script>/g, '')
        .replace(/\s*<img[^>]*src=["']\.\.\/[^"']*["'][^>]*\/?>/g, '');
    },
  };
}

export default defineConfig({
  base: '/canvas/',
  publicDir: 'public',
  plugins: [stripParentAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'canvas.html',
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.{ts,tsx,js}'],
  },
});
