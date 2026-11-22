// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://longislandoysterfarm.com',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap(), mdx()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Astro inlines small island scripts into the HTML as
      // <script type="module">…</script>, which our CSP blocks: script-src is
      // 'self' with no 'unsafe-inline'. Setting the inline limit to 0 forces
      // every script and asset to be emitted as a separate file, so the strict
      // CSP holds without needing per-build hashes.
      assetsInlineLimit: 0,
    },
  },
  build: {
    format: 'directory',
    // Never inline stylesheets: an inline <style> would force
    // style-src 'unsafe-inline' into the CSP. One cached file is the
    // better trade.
    inlineStylesheets: 'never',
  },
  prefetch: { prefetchAll: false },
});
