import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  manifest: {
    name: 'Tomate',
    description: 'A Pomodoro timer that helps you focus — one tomate at a time.',
    permissions: ['alarms', 'notifications', 'storage', 'declarativeNetRequestWithHostAccess'],
    action: {
      default_icon: {
        '16': '/icons/icon-16.png',
        '32': '/icons/icon-32.png',
        '48': '/icons/icon-48.png',
        '128': '/icons/icon-128.png',
      },
    },
  },
});
