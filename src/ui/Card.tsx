import { isRed, SUIT_SYMBOL, type Card as CardT } from '../core/cards';

interface Props {
  card?: CardT;
  faceDown?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  label?: string;
}

const FACE: Record<string, string> = { J: 'J', Q: 'Q', K: 'K' };

/** Playing card drawn as inline SVG; scales with its CSS width. */
export function Card({ card, faceDown, className = '', onClick, disabled, selected, label }: Props) {
  const classes = ['card', className, disabled ? 'card--disabled' : '', selected ? 'card--selected' : '']
    .filter(Boolean)
    .join(' ');
  const svg = faceDown || !card ? <CardBack /> : <CardFace card={card} />;
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

function CardFace({ card }: { card: CardT }) {
  const color = isRed(card.suit) ? 'var(--suit-red)' : 'var(--suit-black)';
  const sym = SUIT_SYMBOL[card.suit];
  const court = FACE[card.rank];
  return (
    <svg viewBox="0 0 60 84" aria-hidden="true">
      <rect x="0.5" y="0.5" width="59" height="83" rx="5" fill="var(--card-face)" stroke="var(--card-edge)" />
      <g fill={color} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700">
        <text x="5" y="16" fontSize="14">{card.rank}</text>
        <text x="5.5" y="28" fontSize="12">{sym}</text>
        <g transform="rotate(180 30 42)">
          <text x="5" y="16" fontSize="14">{card.rank}</text>
          <text x="5.5" y="28" fontSize="12">{sym}</text>
        </g>
        {court ? (
          <>
            <rect x="15" y="16" width="30" height="52" rx="3" fill="none" stroke={color} strokeWidth="1.2" />
            <text x="30" y="40" fontSize="18" textAnchor="middle">{court}</text>
            <text x="30" y="60" fontSize="16" textAnchor="middle">{sym}</text>
          </>
        ) : (
          <text x="30" y="52" fontSize="30" textAnchor="middle">{sym}</text>
        )}
      </g>
    </svg>
  );
}

function CardBack() {
  // No <defs>/patterns: ids would collide and break when the first instance is hidden.
  return (
    <svg viewBox="0 0 60 84" aria-hidden="true">
      <rect x="0.5" y="0.5" width="59" height="83" rx="5" fill="var(--card-face)" stroke="var(--card-edge)" />
      <rect x="4" y="4" width="52" height="76" rx="3" fill="var(--card-back)" />
      <rect x="8" y="8" width="44" height="68" rx="2" fill="none" stroke="var(--card-back-alt)" strokeWidth="2" />
      <path d="M30 22 L42 42 L30 62 L18 42 Z" fill="var(--card-back-alt)" />
    </svg>
  );
}
