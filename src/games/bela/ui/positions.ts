import type { BelaOptions } from '../state';

export type Position = 'bottom' | 'right' | 'top' | 'left';

/** Screen position of each seat, with the human (seat 0) at the bottom. */
export function positionOf(seat: number, options: BelaOptions): Position {
  const ccw: Position[] = ['bottom', 'right', 'top', 'left'];
  const cw: Position[] = ['bottom', 'left', 'top', 'right'];
  return (options.direction === 'ccw' ? ccw : cw)[seat];
}
