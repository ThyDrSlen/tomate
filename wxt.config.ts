import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  manifest: {
    name: 'Tomate',
    description: 'A Pomodoro timer that helps you focus — one tomate at a time.',
    permissions: ['alarms', 'notifications', 'storage', 'tabs', 'declarativeNetRequest'],
    action: {
      default_icon: {
        '16': '/icons/icon-16.png',
        '32': '/icons/icon-32.png',
        '48': '/icons/icon-48.png',
        '128': '/icons/icon-128.png',
      },
    },
    // Allow scripts to load audio assets at runtime via browser.runtime.getURL (#109)
    web_accessible_resources: [
      {
        resources: ['/sounds/*', '/icons/*'],
        matches: ['<all_urls>'],
      },
    ],
    // Explicit CSP: permit canvas-confetti and audio playback (#110)
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; media-src 'self' blob:;",
    },
  },
});
