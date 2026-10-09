import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';
import { errorKey } from '../online/errors';
import { Modal } from '../ui/Modal';
import { useAccount } from './account';
import { GoogleIcon } from './GoogleIcon';
import { NameSuggestion } from './NameSuggestion';
import { isValidUsername, PASSWORD_MIN } from './username';

type Tab = 'guest' | 'account';

/** Three ways in: guest name, username + password, Google. Only shown while signed out. */
export function SignInDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const account = useAccount();
  const [tab, setTab] = useState<Tab>('guest');
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<StringKey | null>(null);
  const [busy, setBusy] = useState(false);

  if (account.status !== 'signedOut') return null;

  const run = async (fn: () => Promise<void>, fail: StringKey) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (e) {
      // The name rules have their own messages; everything else keeps the form's generic one.
      const key = errorKey(e);
      setError(key === 'err.NAME_NOT_ALLOWED' || key === 'err.NAME_TAKEN' ? key : fail);
    } finally {
      setBusy(false);
    }
  };

  const submitGuest = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 24) return setError('auth.errName');
    void run(() => account.signInAsGuest(trimmed), 'auth.errName');
  };

  const submitAccount = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidUsername(username) || password.length < PASSWORD_MIN) return setError('auth.errFormat');
    void run(() => account.signInWithPassword(username, password, flow), flow === 'signIn' ? 'auth.errSignIn' : 'auth.errSignUp');
  };

  return (
    <Modal title={t('auth.title')}>
      <div role="tablist" className="tabs tabs-box mb-4">
        {(['guest', 'account'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tab flex-1 ${tab === id ? 'tab-active' : ''}`}
            onClick={() => {
              setTab(id);
              setError(null);
            }}
          >
            {t(id === 'guest' ? 'auth.guest' : 'auth.account')}
          </button>
        ))}
      </div>

      {tab === 'guest' ? (
        <form onSubmit={submitGuest} className="flex flex-col gap-3">
          <p className="text-sm opacity-70">{t('auth.guestHint')}</p>
          <label className="fieldset">
            <span className="fieldset-legend">{t('auth.name')}</span>
            <input
              className="input w-full"
              value={name}
              maxLength={24}
              autoComplete="nickname"
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('auth.continue')}
          </button>
        </form>
      ) : (
        <form onSubmit={submitAccount} className="flex flex-col gap-3">
          <label className="fieldset">
            <span className="fieldset-legend">{t('auth.username')}</span>
            <input
              className="input w-full"
              value={username}
              maxLength={24}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              onChange={(e) => setUsername(e.target.value)}
            />
            <span className="label text-base-content/80">{t('auth.usernameHint')}</span>
          </label>
          <label className="fieldset">
            <span className="fieldset-legend">{t('auth.password')}</span>
            <input
              className="input w-full"
              type="password"
              value={password}
              autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)}
            />
            {flow === 'signUp' && <span className="label text-base-content/80">{t('auth.passwordHint')}</span>}
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t(flow === 'signIn' ? 'auth.signIn' : 'auth.signUp')}
          </button>
          <button
            type="button"
            className="btn btn-link btn-sm"
            onClick={() => {
              setFlow(flow === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
            }}
          >
            {t(flow === 'signIn' ? 'auth.toSignUp' : 'auth.toSignIn')}
          </button>
        </form>
      )}

      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
          {t(error)}
        </div>
      )}
      {error === 'err.NAME_TAKEN' && tab === 'guest' && (
        <div className="mt-2">
          <NameSuggestion
            name={name}
            onPick={(free) => {
              setName(free);
              setError(null);
            }}
          />
        </div>
      )}

      <div className="divider text-xs">{t('auth.or')}</div>
      <button type="button" className="btn btn-outline w-full" onClick={account.signInWithGoogle}>
        <GoogleIcon />
        {t('menu.signInGoogle')}
      </button>
      <p className="mt-3 text-center text-sm">
        <Link to="/privacy" className="link" onClick={onClose}>
          {t('auth.privacyLink')}
        </Link>
      </p>
      <div className="modal-action">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t('settings.cancel')}
        </button>
      </div>
    </Modal>
  );
}
