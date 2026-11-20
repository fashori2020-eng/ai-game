// بازی ۲۰۴۸ — منطق بازی، انیمیشن و ورودی

const SIZE = 4;          // صفحه ۴×۴
const GAP = 12;          // فاصله بین خانه‌ها (پیکسل، هماهنگ با CSS)
const WIN_VALUE = 2048;  // مقدار برد
const MOVE_MS = 140;     // کمی بیشتر از مدت ترنزیشن CSS

const boardEl = document.getElementById('board');
const gridEl = document.getElementById('grid');
const tilesEl = document.getElementById('tiles');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const undoBtn = document.getElementById('undo');
const newGameBtn = document.getElementById('new-game');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const keepGoingBtn = document.getElementById('keep-going');
const overlayRestartBtn = document.getElementById('overlay-restart');

// نمایش اعداد با ارقام فارسی
const faDigits = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

// ذخیره‌سازی امن (در بعضی محیط‌ها localStorage در دسترس نیست)
const storage = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch {} },
};

let grid;             // grid[row][col] = کاشی یا null — کاشی: {row, col, value, el}
let score = 0;
let best = Number(storage.get('best2048')) || 0;
let won = false;      // آیا به ۲۰۴۸ رسیده‌ایم؟
let over = false;     // آیا بازی تمام شده؟
let animating = false;
let prevState = null; // snapshot برای لغو حرکت: {values, score}
let cell = 0;         // اندازه هر خانه به پیکسل (واکنش‌گرا)

function emptyGrid(){
  return Array.from({length: SIZE}, () => Array(SIZE).fill(null));
}

function buildCells(){
  gridEl.innerHTML = '';
  for(let i = 0; i < SIZE * SIZE; i++){
    const c = document.createElement('div');
    c.className = 'cell';
    gridEl.appendChild(c);
  }
}

function classFor(value){
  return value <= WIN_VALUE ? 'tile-' + value : 'tile-super';
}

function fontSizeFor(value){
  const digits = String(value).length;
  return cell * (digits <= 2 ? 0.55 : digits === 3 ? 0.45 : 0.36);
}

function positionTile(tile){
  tile.el.style.transform =
    `translate(${tile.col * (cell + GAP)}px, ${tile.row * (cell + GAP)}px)`;
}

function styleTile(tile){
  tile.el.style.width = tile.el.style.height = cell + 'px';
  tile.el.style.fontSize = fontSizeFor(tile.value) + 'px';
}

function createTile(row, col, value, isNew){
  const el = document.createElement('div');
  el.className = 'tile ' + classFor(value);
  el.textContent = value;
  tilesEl.appendChild(el);
  const tile = { row, col, value, el };
  styleTile(tile);
  positionTile(tile);
  if(isNew) el.classList.add('new');
  return tile;
}

// افزودن کاشی جدید (۲ با احتمال ۹۰٪، ۴ با احتمال ۱۰٪) در خانه خالی تصادفی
function spawnTile(){
  const empties = [];
  for(let r = 0; r < SIZE; r++)
    for(let c = 0; c < SIZE; c++)
      if(!grid[r][c]) empties.push([r, c]);
  if(!empties.length) return;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  grid[r][c] = createTile(r, c, Math.random() < 0.9 ? 2 : 4, true);
}

function updateScore(gained = 0){
  scoreEl.textContent = faDigits(score);
  if(score > best){
    best = score;
    storage.set('best2048', best);
  }
  bestEl.textContent = faDigits(best);
  if(gained > 0){
    const pop = document.createElement('div');
    pop.className = 'score-add';
    pop.textContent = '+' + faDigits(gained);
    scoreEl.parentElement.appendChild(pop);
    setTimeout(() => pop.remove(), 750);
  }
}

// گرفتن snapshot از وضعیت فعلی برای لغو حرکت
function takeSnapshot(){
  return {
    values: grid.map(row => row.map(t => (t ? t.value : 0))),
    score,
  };
}

function restoreSnapshot(snap){
  tilesEl.innerHTML = '';
  grid = emptyGrid();
  for(let r = 0; r < SIZE; r++)
    for(let c = 0; c < SIZE; c++)
      if(snap.values[r][c])
        grid[r][c] = createTile(r, c, snap.values[r][c], false);
  score = snap.score;
  updateScore();
}

// خطوط حرکت برای هر جهت (از لبه‌ای که کاشی‌ها به سمت آن می‌لغزند)
function linesFor(dir){
  const lines = [];
  for(let i = 0; i < SIZE; i++){
    const line = [];
    for(let j = 0; j < SIZE; j++){
      if(dir === 'left')  line.push([i, j]);
      if(dir === 'right') line.push([i, SIZE - 1 - j]);
      if(dir === 'up')    line.push([j, i]);
      if(dir === 'down')  line.push([SIZE - 1 - j, i]);
    }
    lines.push(line);
  }
  return lines;
}

function move(dir){
  if(animating || over || !overlayEl.hidden) return;
  const snapshot = takeSnapshot();
  let moved = false;
  let gained = 0;
  let reachedWin = false;
  const absorbed = []; // کاشی‌هایی که در ادغام حذف می‌شوند
  const merged = [];   // کاشی‌هایی که مقدارشان دو برابر شده

  for(const line of linesFor(dir)){
    const tiles = line.map(([r, c]) => grid[r][c]).filter(Boolean);
    for(const [r, c] of line) grid[r][c] = null;

    let target = 0;
    let i = 0;
    while(i < tiles.length){
      const tile = tiles[i];
      const [r, c] = line[target];
      if(tile.row !== r || tile.col !== c) moved = true;
      tile.row = r; tile.col = c;
      grid[r][c] = tile;

      const next = tiles[i + 1];
      if(next && next.value === tile.value){
        moved = true;
        tile.value *= 2;
        gained += tile.value;
        if(tile.value === WIN_VALUE) reachedWin = true;
        next.row = r; next.col = c; // کاشی جذب‌شده به سمت بازمانده می‌لغزد
        absorbed.push(next);
        merged.push(tile);
        i += 2;
      } else {
        i += 1;
      }
      target++;
    }
  }

  if(!moved) return; // حرکت نامعتبر: هیچ تغییری رخ نمی‌دهد

  prevState = snapshot;
  score += gained;
  undoBtn.disabled = false;

  // انیمیشن لغزش کاشی‌ها
  for(const t of absorbed) t.el.style.zIndex = 1;
  for(const row of grid)
    for(const t of row)
      if(t) positionTile(t);
  for(const t of absorbed) positionTile(t);

  // به‌روزرسانی ظاهر کاشی‌های ادغام‌شده (مقدار جدید + انیمیشن pop)
  for(const t of merged){
    t.el.className = 'tile ' + classFor(t.value) + ' merged';
    t.el.textContent = t.value;
    t.el.style.zIndex = 2;
    styleTile(t);
    t.el.addEventListener('animationend', () => t.el.classList.remove('merged'), { once: true });
  }

  updateScore(gained);

  animating = true;
  setTimeout(() => {
    for(const t of absorbed) t.el.remove();
    spawnTile();
    animating = false;
    if(reachedWin && !won){
      won = true;
      showOverlay(true);
    } else if(!movesAvailable()){
      over = true;
      showOverlay(false);
    }
  }, MOVE_MS);
}

// آیا هنوز حرکتی ممکن است؟ (خانه خالی یا دو کاشی هم‌عدد مجاور)
function movesAvailable(){
  for(let r = 0; r < SIZE; r++)
    for(let c = 0; c < SIZE; c++){
      const t = grid[r][c];
      if(!t) return true;
      if(c + 1 < SIZE && grid[r][c + 1]?.value === t.value) return true;
      if(r + 1 < SIZE && grid[r + 1][c]?.value === t.value) return true;
    }
  return false;
}

function showOverlay(isWin){
  overlayTitle.textContent = isWin ? 'آفرین! برد!' : 'بازی تمام شد!';
  overlayText.textContent = isWin
    ? 'به کاشی ۲۰۴۸ رسیدید. می‌توانید ادامه دهید و رکورد بزنید!'
    : 'دیگر حرکتی باقی نمانده است. امتیاز شما: ' + faDigits(score);
  keepGoingBtn.hidden = !isWin;
  overlayEl.hidden = false;
}

function hideOverlay(){ overlayEl.hidden = true; }

function newGame(){
  tilesEl.innerHTML = '';
  grid = emptyGrid();
  score = 0;
  won = false;
  over = false;
  animating = false;
  prevState = null;
  undoBtn.disabled = true;
  hideOverlay();
  spawnTile();
  spawnTile();
  updateScore();
}

function undo(){
  if(!prevState || animating) return;
  restoreSnapshot(prevState);
  prevState = null;
  undoBtn.disabled = true;
  over = false;
  hideOverlay();
}

// چیدمان واکنش‌گرا: محاسبه اندازه خانه‌ها و قرار دادن کاشی‌ها
function layout(){
  if(!grid) return;
  cell = (tilesEl.clientWidth - GAP * (SIZE - 1)) / SIZE;
  for(const row of grid)
    for(const t of row)
      if(t){ styleTile(t); positionTile(t); }
}

new ResizeObserver(layout).observe(tilesEl);
window.addEventListener('resize', layout);

// ورودی صفحه‌کلید: جهت‌نما + WASD
const KEYS = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
};
window.addEventListener('keydown', e => {
  if(KEYS[e.key]){
    e.preventDefault();
    move(KEYS[e.key]);
  } else if(e.key === 'u' || e.key === 'U' || (e.ctrlKey && e.key === 'z')){
    undo();
  }
});

// ورودی لمسی/ماوس: کشیدن (swipe) روی صفحه بازی
let swipeStart = null;
boardEl.addEventListener('pointerdown', e => { swipeStart = [e.clientX, e.clientY]; });
boardEl.addEventListener('pointerup', e => {
  if(!swipeStart) return;
  const dx = e.clientX - swipeStart[0];
  const dy = e.clientY - swipeStart[1];
  swipeStart = null;
  if(Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up'));
});
boardEl.addEventListener('pointercancel', () => { swipeStart = null; });
boardEl.addEventListener('contextmenu', e => e.preventDefault());

// دکمه‌ها
undoBtn.addEventListener('click', undo);
newGameBtn.addEventListener('click', newGame);
overlayRestartBtn.addEventListener('click', newGame);
keepGoingBtn.addEventListener('click', hideOverlay);

// شروع بازی
buildCells();
grid = emptyGrid();
layout();
newGame();
