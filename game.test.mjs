import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyBoard, slide, spawn, hasMoves } from './game.mjs';

test('a tile cannot merge twice on the same move', () => {
  const board = [2, 2, 4, 4, ...Array(12).fill(0)];
  const result = slide(board, 'left');
  assert.deepEqual(result.next.slice(0, 4), [4, 8, 0, 0]);
  assert.deepEqual(result.merged, [0, 1]);
  assert.equal(result.points, 12);
  assert.deepEqual(board.slice(0, 4), [2, 2, 4, 4]);
});

test('right, up and down read from their destination edge', () => {
  const board = emptyBoard();
  board[0] = board[4] = board[8] = 2;
  assert.equal(slide(board, 'up').next[0], 4);
  assert.equal(slide(board, 'down').next[12], 4);
  board[1] = board[2] = 2;
  assert.deepEqual(slide(board, 'right').next.slice(0, 4), [0, 0, 2, 4]);
  assert.equal(slide([2, ...Array(15).fill(0)], 'left').changed, false);
});

test('spawning uses an empty cell and supports both values', () => {
  const board = emptyBoard();
  assert.equal(spawn(board, () => 0), 0);
  assert.equal(board[0], 2);
  assert.equal(spawn(board, () => 0.99), 15);
  assert.equal(board[15], 4);
  assert.equal(spawn(Array(16).fill(2)), null);
});

test('game over requires a full board without adjacent matches', () => {
  const board = [2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];
  assert.equal(hasMoves(board), false);
  board[0] = 4;
  assert.equal(hasMoves(board), true);
  board[0] = 0;
  assert.equal(hasMoves(board), true);
});
