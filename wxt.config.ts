import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    permissions: ['alarms', 'notifications', 'storage', 'tabs'],
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
