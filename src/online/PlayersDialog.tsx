import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';
import { useI18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';
import { Modal } from '../ui/Modal';
import { errorKey } from './errors';

interface SeatInfo {
  seat: number;
  kind: string;
  name: string | null;
  isMe: boolean;
  away: boolean;
}

const REASONS = ['name', 'abuse', 'cheating', 'other'] as const;
type Reason = (typeof REASONS)[number];

/** Mute, block or report the other people at this table (architecture §9.4). Targets are seats. */
export function PlayersDialog({ code, seats, onClose }: { code: string; seats: SeatInfo[]; onClose: () => void }) {
  const { t } = useI18n();
  const muted = useQuery(api.moderation.mutedSeats, { code }) ?? [];
  const mute = useMutation(api.moderation.mute);
  const block = useMutation(api.moderation.block);
  const [done, setDone] = useState<Record<number, 'blocked' | 'reported'>>({});
  const [reporting, setReporting] = useState<SeatInfo | null>(null);
  const [error, setError] = useState<StringKey | null>(null);
  const people = seats.filter((s) => !s.isMe && (s.kind === 'user' || s.away));

  const guard = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorKey(e));
    }
  };

  if (reporting) {
    return (
      <ReportForm
        code={code}
        seat={reporting}
        onDone={(sent) => {
          if (sent) setDone({ ...done, [reporting.seat]: 'reported' });
          setReporting(null);
        }}
      />
    );
  }

  return (
    <Modal title={t('mod.players')}>
      {people.length === 0 && <p className="opacity-70">{t('mod.none')}</p>}
      <ul className="flex flex-col gap-3">
        {people.map((s) => {
          const isMuted = muted.includes(s.seat);
          const name = s.name ?? '?';
          return (
            <li key={s.seat} className="flex flex-col gap-2 rounded-2xl bg-base-200 p-3">
              <span className="font-bold">{name}</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-pressed={isMuted}
                  onClick={() => void guard(() => mute({ code, seat: s.seat, muted: !isMuted }))}
                >
                  {t(isMuted ? 'mod.unmute' : 'mod.mute')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-warning btn-outline"
                  disabled={done[s.seat] === 'blocked'}
                  onClick={() =>
                    window.confirm(t('mod.blockConfirm').replace('{name}', name)) &&
                    void guard(async () => {
                      await block({ code, seat: s.seat });
                      setDone({ ...done, [s.seat]: 'blocked' });
                    })
                  }
                >
                  {t(done[s.seat] === 'blocked' ? 'mod.blocked' : 'mod.block')}
                </button>
                <button type="button" className="btn btn-sm btn-error btn-outline" disabled={done[s.seat] === 'reported'} onClick={() => setReporting(s)}>
                  {t(done[s.seat] === 'reported' ? 'mod.reported' : 'mod.report')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm opacity-70 mt-3">{t('mod.muteHint')}</p>
      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
          {t(error)}
        </div>
      )}
      <div className="modal-action">
        <button type="button" className="btn" onClick={onClose}>
          {t('mod.close')}
        </button>
      </div>
    </Modal>
  );
}

function ReportForm({ code, seat, onDone }: { code: string; seat: SeatInfo; onDone: (sent: boolean) => void }) {
  const { t } = useI18n();
  const report = useMutation(api.moderation.report);
  const [reason, setReason] = useState<Reason>('name');
  const [error, setError] = useState<StringKey | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await report({ code, seat: seat.seat, reason });
      onDone(true);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('mod.reportTitle').replace('{name}', seat.name ?? '?')}>
      <fieldset className="flex flex-col gap-2">
        {REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" className="radio radio-sm" name="reason" checked={reason === r} onChange={() => setReason(r)} />
            {t(`mod.reason.${r}`)}
          </label>
        ))}
      </fieldset>
      <p className="text-sm opacity-70 mt-3">{t('mod.reportHint')}</p>
      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
          {t(error)}
        </div>
      )}
      <div className="modal-action">
        <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>
          {t('settings.cancel')}
        </button>
        <button type="button" className="btn btn-error" disabled={busy} onClick={() => void send()}>
          {t('mod.send')}
        </button>
      </div>
    </Modal>
  );
}
