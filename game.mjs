export const size = 4;
export const emptyBoard = () => Array(size * size).fill(0);

export function spawn(board, random = Math.random) {
  const free = board.flatMap((value, index) => value ? [] : [index]);
  if (!free.length) return null;
  const index = free[Math.floor(random() * free.length)];
  board[index] = random() < 0.9 ? 2 : 4;
  return index;
}

// Read each line from the destination edge. A merged pair is consumed once.
export function slide(board, direction) {
  const next = emptyBoard();
  const motions = [];
  const merged = [];
  let points = 0;
  for (let line = 0; line < size; line++) {
    const indices = Array.from({ length: size }, (_, step) => {
      const offset = direction === 'right' || direction === 'down' ? size - 1 - step : step;
      return direction === 'left' || direction === 'right' ? line * size + offset : offset * size + line;
    });
    const occupied = indices.filter(index => board[index]);
    for (let source = 0, target = 0; source < occupied.length; source++, target++) {
      const from = occupied[source];
      const to = indices[target];
      let value = board[from];
      motions.push({ from, to, value });
      if (board[occupied[source + 1]] === value) {
        motions.push({ from: occupied[++source], to, value });
        value *= 2;
        points += value;
        merged.push(to);
      }
      next[to] = value;
    }
  }
  return { next, motions, merged, points, changed: motions.some(({ from, to }) => from !== to) };
}

export function hasMoves(board) {
  return board.some((value, index) => !value ||
    (index % size < size - 1 && value === board[index + 1]) || value === board[index + size]);
}
