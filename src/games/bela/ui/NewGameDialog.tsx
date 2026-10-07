import { useState } from 'react';
import { useI18n } from '../../../i18n/i18n';
import { Modal } from '../../../ui/Modal';
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
  return (
    <Modal title={t('settings.title')}>
      <fieldset className="choice">
        <legend>{t('settings.target')}</legend>
        {([501, 701, 1001] as const).map((target) => (
          <label key={target}>
            <input type="radio" name="target" checked={opts.target === target} onChange={() => setOpts({ ...opts, target })} />
            {target}
          </label>
        ))}
      </fieldset>
      <fieldset className="choice">
        <legend>{t('settings.direction')}</legend>
        {(['ccw', 'cw'] as const).map((direction) => (
          <label key={direction}>
            <input
              type="radio"
              name="direction"
              checked={opts.direction === direction}
              onChange={() => setOpts({ ...opts, direction })}
            />
            {t(direction === 'ccw' ? 'settings.ccw' : 'settings.cw')}
          </label>
        ))}
      </fieldset>
      <fieldset className="choice">
        <legend>{t('settings.houseRules')}</legend>
        <label>
          <input
            type="checkbox"
            checked={opts.belaAlwaysCounts}
            onChange={(e) => setOpts({ ...opts, belaAlwaysCounts: e.target.checked })}
          />
          {t('settings.belaAlways')}
        </label>
      </fieldset>
      <fieldset className="choice">
        <legend>{t('settings.tie')}</legend>
        {(['hangs', 'fails'] as const).map((tie) => (
          <label key={tie}>
            <input type="radio" name="tie" checked={opts.tie === tie} onChange={() => setOpts({ ...opts, tie })} />
            {t(tie === 'hangs' ? 'settings.tieHangs' : 'settings.tieFails')}
          </label>
        ))}
      </fieldset>
      <div className="modal-actions">
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {t('settings.cancel')}
          </button>
        )}
        <button type="button" className="btn" onClick={() => onStart(opts)}>
          {t('settings.start')}
        </button>
      </div>
    </Modal>
  );
}
