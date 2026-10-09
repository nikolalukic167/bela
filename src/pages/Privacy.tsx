import { useI18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';
import { AppShell } from '../ui/AppShell';

const SECTIONS = ['browser', 'server', 'processors', 'tracking', 'retention', 'delete'] as const;

/** What the app stores, where and for how long (architecture §9.4). Keep in step with convex/schema.ts. */
export function Privacy() {
  const { t } = useI18n();
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-12">
        <h1 className="text-2xl font-bold mb-1">{t('privacy.title')}</h1>
        <p className="text-sm opacity-70 mb-4">{t('privacy.updated')}</p>
        <p className="mb-6">{t('privacy.intro')}</p>
        {SECTIONS.map((s) => (
          <section key={s} className="mb-6">
            <h2 className="text-lg font-bold mb-2">{t(`privacy.${s}.title` as StringKey)}</h2>
            <Body text={t(`privacy.${s}.body` as StringKey)} />
          </section>
        ))}
      </main>
    </AppShell>
  );
}

/** Lines starting with "- " become a list; other lines are paragraphs. */
function Body({ text }: { text: string }) {
  const lines = text.split('\n');
  const items = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
  const rest = lines.filter((l) => !l.startsWith('- '));
  return (
    <>
      {items.length > 0 && (
        <ul className="list-disc pl-5 flex flex-col gap-1 mb-2">
          {items.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {rest.map((l) => (
        <p key={l} className="mb-2">
          {l}
        </p>
      ))}
    </>
  );
}
