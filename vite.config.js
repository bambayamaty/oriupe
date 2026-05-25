import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // ── ROOT ──
        main:                resolve(__dirname, 'index.html'),

        // ── PUBLIC ──
        home:                resolve(__dirname, 'src/pages/home/index.html'),
        auth:                resolve(__dirname, 'src/pages/auth/index.html'),
        catalog:             resolve(__dirname, 'src/pages/catalog/index.html'),
        detail:              resolve(__dirname, 'src/pages/detail/index.html'),
        profile:             resolve(__dirname, 'src/pages/profile/index.html'),
        onboarding:          resolve(__dirname, 'src/pages/onboarding/index.html'),
        offers:              resolve(__dirname, 'src/pages/offers/index.html'),
        pricing:             resolve(__dirname, 'src/pages/pricing/index.html'),
        blog:                resolve(__dirname, 'src/pages/blog/index.html'),
        academy:             resolve(__dirname, 'src/pages/academy/index.html'),
        about:               resolve(__dirname, 'src/pages/about/index.html'),
        contact:             resolve(__dirname, 'src/pages/contact/index.html'),
        howItWorks:          resolve(__dirname, 'src/pages/how-it-works/index.html'),
        faq:                 resolve(__dirname, 'src/pages/faq/index.html'),
        help:                resolve(__dirname, 'src/pages/help/index.html'),
        careers:             resolve(__dirname, 'src/pages/careers/index.html'),
        press:               resolve(__dirname, 'src/pages/press/index.html'),
        impact:              resolve(__dirname, 'src/pages/impact/index.html'),
        privacy:             resolve(__dirname, 'src/pages/privacy/index.html'),
        terms:               resolve(__dirname, 'src/pages/terms/index.html'),

        // ── DASHBOARDS ──
        dashboardClient:     resolve(__dirname, 'src/pages/dashboard/client/index.html'),
        dashboardFreelance:  resolve(__dirname, 'src/pages/dashboard/freelance/index.html'),
        dashboardEscrow:     resolve(__dirname, 'src/pages/dashboard/escrow/index.html'),

        // ── MESSAGERIE & CHAT ──
        messagerie:          resolve(__dirname, 'src/pages/messagerie/index.html'),
        chat:                resolve(__dirname, 'src/pages/chat/index.html'),

        // ── ADMIN ──
        adminIndex:          resolve(__dirname, 'src/pages/admin/index.html'),
        adminLogin:          resolve(__dirname, 'src/pages/admin/login.html'),
        adminMod:            resolve(__dirname, 'src/pages/admin/moderateur.html'),
        adminSupport:        resolve(__dirname, 'src/pages/admin/support.html'),
        adminFinance:        resolve(__dirname, 'src/pages/admin/finance.html'),

        // ── CRÉATION / PUBLICATION ──
        createService:       resolve(__dirname, 'src/pages/create-service/index.html'),
        publishProject:      resolve(__dirname, 'src/pages/publish-project/index.html'),

        // ── AUTRES ──
        disputes:            resolve(__dirname, 'src/pages/disputes/index.html'),
        notFound:            resolve(__dirname, 'src/pages/404/index.html'),
      },
    },
  },

  server: {
    port: 5173,
    open: '/src/pages/home/index.html',
  },
});
