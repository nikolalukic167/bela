import type { Card as CardT } from '../core/cards';
import { CardBack, DECKS } from './decks';
import { useDeck } from './settings';

interface Props {
  card?: CardT;
  faceDown?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  label?: string;
}


/** Playing card drawn as inline SVG in the viewer's chosen deck; scales with its CSS width. */
export function Card({ card, faceDown, className = '', onClick, disabled, selected, label }: Props) {
  const classes = ['playing-card', className, disabled ? 'playing-card--disabled' : '', selected ? 'playing-card--selected' : '']
    .filter(Boolean)
    .join(' ');
  const { Face } = DECKS[useDeck()];
  const svg = faceDown || !card ? <CardBack /> : <Face card={card} />;
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={selected}>
        {svg}
      </button>
    );
  }
  return (
    <div className={classes} aria-label={label} role={label ? 'img' : undefined}>
      {svg}
    </div>
  );
}

