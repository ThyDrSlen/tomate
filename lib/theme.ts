import { getTheme, type ThemeMode } from './storage';

const applyTheme = (mode: ThemeMode): void => {
  const isDark =
    mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
};

export const initTheme = async (): Promise<void> => {
  const theme = await getTheme();
  applyTheme(theme);

  if (theme === 'system') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applyTheme('system');
    });
  }
};
