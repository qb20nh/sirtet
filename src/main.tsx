/* v8 ignore start -- Vite browser entrypoint is covered by build and browser smoke. */
import { render } from 'preact';

import { App } from './App';
import './styles.css';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing #app root element.');
}

render(<App />, root);
/* v8 ignore stop */
