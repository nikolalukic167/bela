import { useMutation, useQuery } from 'convex/react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useI18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';
import { errorKey } from '../online/errors';
import { OnlineGate } from '../online/OnlineGate';
import { AppShell } from '../ui/AppShell';
import { Modal } from '../ui/Modal';
import { useAccount } from './account';

/** The signed-in player's own settings: name, blocked and muted players, account deletion. */
export function AccountPage() {
  return (
    <OnlineGate>
      <Account />
    </OnlineGate>
  );
}

function Account() {
  const { t } = useI18n();
  const account = useAccount();
  if (account.status !== 'signedIn' || !account.profile) {
    return (
      <AppShell>
        <main className="p-8 text-center">
          <span className="loading loading-spinner" />
        </main>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-xl px-4 pb-12">
        <h1 className="text-2xl font-bold py-6">{t('account.title')}</h1>
        <RenameCard current={account.profile.name} />
        <PeopleCard />
        <DeleteCard signOut={account.signOut} />
      </main>
    </AppShell>
  );
}

function RenameCard({ current }: { current: string }) {
  const { t } = useI18n();
  const rename = useMutation(api.users.rename);
  const [name, setName] = useState(current);
  const [status, setStatus] = useState<{ ok: boolean; key: StringKey } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await rename({ name });
      setStatus({ ok: true, key: 'account.saved' });
    } catch (err) {
      setStatus({ ok: false, key: errorKey(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card bg-base-200 mb-5">
      <form className="card-body gap-3" onSubmit={(e) => void submit(e)}>
        <h2 className="card-title">{t('account.nameTitle')}</h2>
        <p className="text-sm opacity-70">{t('account.nameHint')}</p>
        <label className="fieldset">
          <span className="fieldset-legend">{t('auth.name')}</span>
          <input className="input w-full" value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary self-start" disabled={busy || name.trim() === current}>
          {t('account.save')}
        </button>
        {status && (
          <div role={status.ok ? 'status' : 'alert'} className={`alert alert-soft text-sm ${status.ok ? 'alert-success' : 'alert-error'}`}>
            {t(status.key)}
          </div>
        )}
      </form>
    </section>
  );
}

/** Blocked and muted players, with a way back. */
function PeopleCard() {
  const { t } = useI18n();
  const lists = useQuery(api.moderation.lists, {});
  const unblock = useMutation(api.moderation.unblock);
  const unmute = useMutation(api.moderation.unmute);
  if (!lists) return null;
  const section = (title: StringKey, hint: StringKey | null, none: StringKey, rows: { userId: Id<'users'>; name: string }[], action: StringKey, undo: (userId: Id<'users'>) => unknown) => (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold">{t(title)}</h3>
      {hint && <p className="text-sm opacity-70">{t(hint)}</p>}
      {rows.length === 0 ? (
        <p className="text-sm opacity-70">{t(none)}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.userId} className="flex items-center justify-between gap-2">
              <span className="truncate">{r.name}</span>
              <button type="button" className="btn btn-xs" onClick={() => void undo(r.userId)}>
                {t(action)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <section className="card bg-base-200 mb-5">
      <div className="card-body gap-4">
        {section('account.blockedTitle', 'account.blockedHint', 'account.noneBlocked', lists.blocked, 'mod.unblock', (userId) => unblock({ userId }))}
        {section('account.mutedTitle', 'mod.muteHint', 'account.noneMuted', lists.muted, 'mod.unmute', (userId) => unmute({ userId }))}
      </div>
    </section>
  );
}

/** GDPR deletion (architecture §9.2), behind an explicit confirmation. */
function DeleteCard({ signOut }: { signOut: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const deleteAccount = useMutation(api.users.deleteAccount);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<StringKey | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount({});
      navigate('/');
      signOut(); // the session is already gone on the server; this clears the browser's token
    } catch (e) {
      setError(errorKey(e));
      setBusy(false);
    }
  };

  return (
    <section className="card bg-base-200 mb-5">
      <div className="card-body gap-3">
        <h2 className="card-title">{t('account.deleteTitle')}</h2>
        <p className="text-sm opacity-70">{t('account.deleteHint')}</p>
        <button type="button" className="btn btn-error btn-outline self-start" onClick={() => setConfirming(true)}>
          {t('account.delete')}
        </button>
      </div>
      {confirming && (
        <Modal title={t('account.deleteConfirmTitle')}>
          <p className="mb-2">{t('account.deleteConfirm1')}</p>
          <p className="font-bold">{t('account.deleteConfirm2')}</p>
          {error && (
            <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
              {t(error)}
            </div>
          )}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
              {t('settings.cancel')}
            </button>
            <button type="button" className="btn btn-error" disabled={busy} onClick={() => void confirm()}>
              {t('account.deleteYes')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
