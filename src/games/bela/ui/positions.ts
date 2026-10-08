import type { BelaOptions } from '../state';

export type Position = 'bottom' | 'right' | 'top' | 'left';

/** Screen position of a seat, with the viewing player (the local human is seat 0) at the bottom. */
export function positionOf(seat: number, options: BelaOptions, viewer = 0): Position {
  const ccw: Position[] = ['bottom', 'right', 'top', 'left'];
  const cw: Position[] = ['bottom', 'left', 'top', 'right'];
  return (options.direction === 'ccw' ? ccw : cw)[(seat - viewer + 4) % 4];
}
