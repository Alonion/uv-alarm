import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { loadBootstrap } from './services/storage';
import { applyTheme } from './services/theme';

async function bootstrap(): Promise<void> {
  const data = await loadBootstrap();
  applyTheme(data.settings.theme);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App bootstrap={data} />
    </StrictMode>,
  );
}

void bootstrap();
