// Cloudflare Pages configuration for native Git integration.
// This config tells Cloudflare Pages to run prerendering after Vite build.
// Docs: https://developers.cloudflare.com/pages/configuration/build-configuration/

export default {
  // Optimize for SEO: build static HTML for all high-priority routes
  build: {
    command: 'npm run build && npm run prerender',
    cwd: undefined, // inherit working directory
    root_dir: '.',
  },
  env: {
    // Pass env vars for prerender script
    PRERENDER_STRICT: '1',
  },
};
