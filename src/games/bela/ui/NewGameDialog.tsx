import { useState } from 'react';
import { useI18n } from '../../../i18n/i18n';
import { Modal, ModalActions } from '../../../ui/Modal';
import type { BelaOptions } from '../state';

export function NewGameDialog({
  initial,
  onStart,
  onCancel,
}: {
  initial: BelaOptions;
  onStart: (o: BelaOptions) => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [opts, setOpts] = useState(initial);
  const radio = <T,>(name: string, value: T, current: T, label: string, set: (v: T) => void) => (
    <label key={String(value)} className="label cursor-pointer gap-2">
      <input type="radio" name={name} className="radio radio-primary radio-sm" checked={current === value} onChange={() => set(value)} />
      <span className="text-base-content">{label}</span>
    </label>
  );
  return (
    <Modal title={t('settings.title')}>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{t('settings.target')}</legend>
        <div className="flex flex-wrap gap-4">
          {([501, 701, 1001] as const).map((target) =>
            radio('target', target, opts.target, String(target), (v) => setOpts({ ...opts, target: v })),
          )}
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{t('settings.direction')}</legend>
        <div className="flex flex-wrap gap-4">
          {(['ccw', 'cw'] as const).map((d) =>
            radio('direction', d, opts.direction, t(d === 'ccw' ? 'settings.ccw' : 'settings.cw'), (v) => setOpts({ ...opts, direction: v })),
          )}
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{t('settings.houseRules')}</legend>
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={opts.belaAlwaysCounts}
            onChange={(e) => setOpts({ ...opts, belaAlwaysCounts: e.target.checked })}
          />
          <span className="text-base-content">{t('settings.belaAlways')}</span>
        </label>
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{t('settings.tie')}</legend>
        <div className="flex flex-wrap gap-4">
          {(['hangs', 'fails'] as const).map((tie) =>
            radio('tie', tie, opts.tie, t(tie === 'hangs' ? 'settings.tieHangs' : 'settings.tieFails'), (v) => setOpts({ ...opts, tie: v })),
          )}
        </div>
      </fieldset>
      <ModalActions>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('settings.cancel')}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => onStart(opts)}>
          {t('settings.start')}
        </button>
      </ModalActions>
    </Modal>
  );
}
