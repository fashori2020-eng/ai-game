import { emptyBoard, size, spawn, slide, hasMoves } from './game.mjs';

const get = id => document.getElementById(id);
const surface = get('board');
const tiles = surface.querySelector('.tiles');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = 'puzzle-club-2048-best';
let best = 0;
try { best = Math.max(0, Number(localStorage.getItem(storageKey)) || 0); } catch { /* Storage can be blocked. */ }
let board, score, previous, won, outcome, timer, swipe;

for (let i = 0; i < size * size; i++) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  surface.querySelector('.cells').append(cell);
}

function position(index) {
  return { left: `${index % size * 25.5}%`, top: `${Math.floor(index / size) * 25.5}%` };
}

function tile(index, value) {
  const item = document.createElement('div');
  item.className = 'tile';
  item.textContent = value;
  item.dataset.value = value;
  if (value >= 1024) item.dataset.large = '';
  if (value > 2048) item.style.background = `hsl(${(Math.log2(value) * 47) % 360} 76% 76%)`;
  Object.assign(item.style, position(index));
  tiles.append(item);
  return item;
}

function draw(merged = [], added = null) {
  tiles.replaceChildren();
  board.forEach((value, index) => {
    if (!value) return;
    const item = tile(index, value);
    if (!reducedMotion.matches && (merged.includes(index) || added === index)) {
      const frames = merged.includes(index) ? [{scale: 0.88}, {scale: 1.12}, {scale: 1}] : [{scale: 0.5, opacity: 0}, {scale: 1, opacity: 1}];
      item.animate(frames, { duration: 150, easing: 'ease-out' });
    }
  });
}

function sync() {
  get('score').textContent = score;
  get('best').textContent = best;
  get('undo').disabled = !previous;
  get('result').hidden = !outcome;
  surface.setAttribute('aria-label', 'صفحهٔ چهار در چهار: ' + board.map(value => value || 'خالی').join('، '));
  if (!outcome) return;
  const victory = outcome === 'win';
  get('result-title').textContent = victory ? 'به ۲۰۴۸ رسیدی!' : 'بازی تمام شد';
  get('result-text').textContent = victory ? 'می‌توانی برای رکورد بالاتر ادامه بدهی.' : 'دیگر حرکت معتبری باقی نمانده است.';
  get('result-action').textContent = victory ? 'ادامه بازی' : 'شروع مجدد';
  get('result-action').focus();
}

function restart() {
  clearTimeout(timer);
  timer = null;
  previous = outcome = null;
  won = false;
  score = 0;
  board = emptyBoard();
  spawn(board);
  spawn(board);
  draw();
  sync();
}

function move(direction) {
  if (outcome || timer) return;
  const { next, motions, merged, points, changed } = slide(board, direction);
  if (!changed) return;
  previous = { board, score, won };
  board = next;
  score += points;
  if (score > best) {
    best = score;
    try { localStorage.setItem(storageKey, String(best)); } catch { /* Keep the in-memory record. */ }
  }
  const added = spawn(board);
  const finish = () => {
    timer = null;
    if (!won && board.includes(2048)) {
      won = true;
      outcome = 'win';
    } else if (!hasMoves(board)) outcome = 'loss';
    draw(merged, added);
    sync();
  };
  if (reducedMotion.matches) return finish();
  tiles.replaceChildren();
  for (const { from, to, value } of motions) {
    tile(from, value).animate([position(from), position(to)], { duration: 105, easing: 'ease-out', fill: 'forwards' });
  }
  timer = setTimeout(finish, 105);
}

get('restart').onclick = () => { restart(); surface.focus(); };
get('undo').onclick = () => {
  if (!previous) return;
  clearTimeout(timer);
  timer = null;
  ({ board, score, won } = previous);
  previous = outcome = null;
  draw();
  sync();
  surface.focus();
};
get('result-action').onclick = () => {
  if (outcome === 'loss') restart();
  else {
    outcome = hasMoves(board) ? null : 'loss';
    sync();
  }
  if (!outcome) surface.focus();
};

window.addEventListener('keydown', event => {
  const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  if (!Object.hasOwn(directions, event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  move(directions[event.key]);
});
surface.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  surface.setPointerCapture(event.pointerId);
});
surface.addEventListener('pointerup', event => {
  if (swipe?.id !== event.pointerId) return;
  const x = event.clientX - swipe.x;
  const y = event.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(x), Math.abs(y)) < 20) return;
  move(Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up'));
});
surface.addEventListener('pointercancel', event => { if (swipe?.id === event.pointerId) swipe = null; });
restart();
