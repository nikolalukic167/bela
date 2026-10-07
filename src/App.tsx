import { HashRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from './i18n/i18n';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Rules } from './pages/Rules';
import { SettingsProvider } from './ui/settings';

export function App() {
  return (
    <I18nProvider>
      <SettingsProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play/:gameId" element={<Play />} />
            <Route path="/rules/:gameId" element={<Rules />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </HashRouter>
      </SettingsProvider>
    </I18nProvider>
  );
}
