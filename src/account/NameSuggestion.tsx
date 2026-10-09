import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useI18n } from '../i18n/i18n';

/**
 * After NAME_TAKEN: offers the first free variant ("Ana 2"). Rendered only after the server
 * answered, so it never runs in the offline build, which has no Convex client.
 */
export function NameSuggestion({ name, onPick }: { name: string; onPick: (name: string) => void }) {
  const { t } = useI18n();
  const suggestion = useQuery(api.users.suggestName, { name });
  if (!suggestion) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{t('name.suggest').replace('{name}', suggestion)}</span>
      <button type="button" className="btn btn-xs btn-primary" onClick={() => onPick(suggestion)}>
        {t('name.useSuggestion')}
      </button>
    </div>
  );
}
