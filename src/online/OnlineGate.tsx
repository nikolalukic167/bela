import { useState, type ReactNode } from 'react';
import { SignInDialog } from '../account/SignInDialog';
import { useAccount } from '../account/account';
import { useI18n } from '../i18n/i18n';
import { AppShell } from '../ui/AppShell';

/**
 * Renders children (which use Convex hooks) only when signed in. Online pages sit
 * behind this, so the offline build, which has no Convex client, never calls a hook.
 */
export function OnlineGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const account = useAccount();
  const [signingIn, setSigningIn] = useState(false);

  if (account.status === 'signedIn') return <>{children}</>;
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('online.title')}</h1>
        {account.status === 'unavailable' && <p className="opacity-70">{t('online.unavailable')}</p>}
        {account.status === 'loading' && <span className="loading loading-spinner" />}
        {account.status === 'signedOut' && (
          <>
            <p className="opacity-70 mb-4">{t('online.needSignIn')}</p>
            <button type="button" className="btn btn-primary" onClick={() => setSigningIn(true)}>
              {t('menu.signIn')}
            </button>
            {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
          </>
        )}
      </main>
    </AppShell>
  );
}
