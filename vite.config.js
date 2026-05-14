import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:              resolve(__dirname, 'index.html'),
        home:              resolve(__dirname, 'src/pages/home/index.html'),
        academy:           resolve(__dirname, 'src/pages/academy/index.html'),
        offers:            resolve(__dirname, 'src/pages/offers/index.html'),
        auth:              resolve(__dirname, 'src/pages/auth/index.html'),
        blog:              resolve(__dirname, 'src/pages/blog/index.html'),
        catalog:           resolve(__dirname, 'src/pages/catalog/index.html'),
        chat:              resolve(__dirname, 'src/pages/chat/index.html'),
        dashboardClient:   resolve(__dirname, 'src/pages/dashboard/client/index.html'),
        dashboardFreelance:resolve(__dirname, 'src/pages/dashboard/freelance/index.html'),
        detail:            resolve(__dirname, 'src/pages/detail/index.html'),
        onboarding:        resolve(__dirname, 'src/pages/onboarding/index.html'),
        profile:           resolve(__dirname, 'src/pages/profile/index.html'),
      },
    },
  },

  server: {
    port: 5173,
    open: '/src/pages/home/index.html',
  },
});
