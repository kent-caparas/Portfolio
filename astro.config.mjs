// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://portfolio.example.com',
  integrations: [mdx(), preact(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
