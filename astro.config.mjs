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
  vite: { plugins: [tailwindcss()] },
  build: {
    format: 'directory',
    // Never inline stylesheets: an inline <style> would force
    // style-src 'unsafe-inline' into the CSP. One cached file is the
    // better trade.
    inlineStylesheets: 'never',
  },
  prefetch: { prefetchAll: false },
});
