import { HashRouter, Route, Routes } from 'react-router-dom';
import { AccountProvider } from './account/account';
import { I18nProvider } from './i18n/i18n';
import { AdminPage } from './admin/AdminPage';
import { OnlineLobbyPage } from './online/OnlineLobby';
import { OnlineTablePage } from './online/OnlineTable';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Rules } from './pages/Rules';
import { SettingsProvider } from './ui/settings';

export function App() {
  return (
    <I18nProvider>
      <SettingsProvider>
        <AccountProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/play/:gameId" element={<Play />} />
              <Route path="/rules/:gameId" element={<Rules />} />
              <Route path="/online" element={<OnlineLobbyPage />} />
              <Route path="/t/:code" element={<OnlineTablePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </HashRouter>
        </AccountProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}
