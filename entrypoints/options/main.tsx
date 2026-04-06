import { render } from 'solid-js/web';
import { initTheme } from '@/lib/theme';
import App from './App';
import './style.css';

initTheme();
render(() => <App />, document.getElementById('app')!);
