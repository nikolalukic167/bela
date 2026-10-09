import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { QUICK_PHRASES, type QuickPhrase } from '../../convex/lib/chatLogic';
import { CHAT_TEXT_MAX } from '../../convex/lib/config';
import { useI18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';
import { errorKey } from './errors';

type Message = NonNullable<ReturnType<typeof useQuery<typeof api.chat.list>>>[number];

/** How long a message stays on screen during a game. */
const TOAST_MS = 6000;

/**
 * Messages in `list` not seen before. On the first load everything is marked seen and nothing
 * is reported, so opening a table doesn't replay old messages.
 */
export function newArrivals<M extends { id: string }>(seen: Set<string>, list: M[], first: boolean): M[] {
  const fresh = list.filter((m) => !seen.has(m.id));
  for (const m of fresh) seen.add(m.id);
  return first ? [] : fresh;
}

function useTableChat(code: string) {
  const { t } = useI18n();
  const messages = useQuery(api.chat.list, { code });
  const sendMutation = useMutation(api.chat.send);
  const [error, setError] = useState<string | null>(null);
  const send = async (msg: { phrase: QuickPhrase } | { text: string }) => {
    setError(null);
    try {
      await sendMutation({ code, ...msg });
      return true;
    } catch (e) {
      setError(t(errorKey(e)));
      return false;
    }
  };
  return { messages, send, error };
}

const phraseText = (t: (k: StringKey) => string, m: { phrase: string | null; text: string | null }) =>
  m.phrase ? t(`phrase.${m.phrase}` as StringKey) : (m.text ?? '');

function PhraseGrid({ onPick }: { onPick: (p: QuickPhrase) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {QUICK_PHRASES.map((p) => (
        <button key={p} type="button" className="btn btn-sm h-auto min-h-9 px-1 py-1 text-xs" onClick={() => onPick(p)}>
          {t(`phrase.${p}`)}
        </button>
      ))}
    </div>
  );
}

/**
 * In-game chat: a navbar button opens the quick phrases; new messages show for a few seconds
 * under the navbar. No free text while playing (architecture §8).
 */
export function GameChat({ code }: { code: string }) {
  const { t } = useI18n();
  const { messages, send, error } = useTableChat(code);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Message[]>([]);
  const seen = useRef(new Set<string>());
  const loaded = useRef(false);

  useEffect(() => {
    if (!messages) return;
    const fresh = newArrivals(seen.current, messages, !loaded.current);
    loaded.current = true;
    if (fresh.length === 0) return;
    setShown((s) => [...s, ...fresh].slice(-3));
    const timer = setTimeout(() => setShown((s) => s.filter((m) => !fresh.includes(m))), TOAST_MS);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn-square btn-ghost btn-sm"
        aria-label={t('chat.open')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v11H9l-5 4z" />
        </svg>
      </button>
      {open && (
        <div className="card fixed inset-x-3 top-14 z-40 mx-auto max-w-sm border border-accent bg-base-300 shadow-2xl" role="dialog" aria-label={t('chat.open')}>
          <div className="card-body gap-2 p-3">
            <PhraseGrid
              onPick={(phrase) =>
                void send({ phrase }).then((ok) => {
                  if (ok) setOpen(false);
                })
              }
            />
            <p className="text-xs text-base-content/75">{t('chat.phrasesOnly')}</p>
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
          </div>
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-30 flex flex-col items-center gap-1" aria-live="polite">
        {shown.map((m) => (
          <div key={m.id} className="rounded-full bg-base-100 px-3 py-1 text-sm shadow-lg">
            <strong>{m.name}:</strong> {phraseText(t, m)}
          </div>
        ))}
      </div>
    </>
  );
}

/** Lobby chat: quick phrases, plus free text when the table is unrated. */
export function LobbyChat({ code, rated }: { code: string; rated: boolean }) {
  const { t } = useI18n();
  const { messages, send, error } = useTableChat(code);
  const [draft, setDraft] = useState('');
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => list.current?.lastElementChild?.scrollIntoView({ block: 'nearest' }), [messages?.length]);

  return (
    <section className="card mb-6 rounded-3xl bg-base-200" aria-labelledby="lobby-chat-title">
      <div className="card-body gap-3 p-4">
        <h2 id="lobby-chat-title" className="text-xs font-bold uppercase tracking-widest text-base-content/75">
          {t('chat.title')}
        </h2>
        <ol ref={list} className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm" aria-live="polite">
          {messages?.length === 0 && <li className="text-base-content/75">{t('chat.empty')}</li>}
          {messages?.map((m) => (
            <li key={m.id} className={m.mine ? 'text-primary' : ''}>
              <strong>{m.name}:</strong> {phraseText(t, m)}
            </li>
          ))}
        </ol>
        <PhraseGrid onPick={(phrase) => void send({ phrase })} />
        {rated ? (
          <p className="text-xs text-base-content/75">{t('chat.ratedPhrasesOnly')}</p>
        ) : (
          <form
            className="join w-full"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) void send({ text: draft }).then((ok) => ok && setDraft(''));
            }}
          >
            <input
              className="input join-item flex-1"
              value={draft}
              maxLength={CHAT_TEXT_MAX}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('chat.placeholder')}
              aria-label={t('chat.placeholder')}
            />
            <button type="submit" className="btn btn-primary join-item">
              {t('chat.send')}
            </button>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </div>
    </section>
  );
}
