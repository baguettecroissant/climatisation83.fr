import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://climatisation-var.fr',
  output: 'static',
  adapter: cloudflare({
    imageService: 'passthrough',
    prerenderEnvironment: 'node'
  }),
  integrations: [
    sitemap({
      filter: (page) => 
        !page.includes('/mentions-legales') && 
        !page.includes('/politique-confidentialite') && 
        !page.includes('/confirmation')
    })
  ]
});
