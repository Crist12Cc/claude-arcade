export interface SerpentinaState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}
export interface SerpentinaEngine {
  start(): void;
  destroy(): void;
  setPaused(paused: boolean): void;
  restart(): void;
}
const W = 800;
const H = 600;
const CELL = 20;
const COLS = W / CELL;
const ROWS = H / CELL;
const BASE_STEP = 0.16;
const MIN_STEP = 0.07;
const STEP_DECAY = 0.008;
const FOODS_PER_LEVEL = 5;
const FRUIT_NAMES = [
  'apple',
  'orange',
  'cherry',
  'grape',
  'strawberry',
  'watermelon',
  'kiwi',
  'lemon',
  'pepper',
  'peach',
] as const;
type SpriteRect = { x: number; y: number; w: number; h: number };
const SPRITE_ATLAS: Record<(typeof FRUIT_NAMES)[number], SpriteRect> = {
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
};
type Vec = { x: number; y: number };
type GameStatus = 'playing' | 'gameover';
type Dir = 'up' | 'down' | 'left' | 'right';
const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};
const DELTA: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export function createSerpentinaEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: SerpentinaState) => void
): SerpentinaEngine {
  const ctx = canvas.getContext('2d')!;
  const fruitImg = new Image();
  fruitImg.src = '/games/serpentina/fruits.png';
  const CAPTURED_CODES = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
  ]);
  let dirQueue: Dir[] = [];
  function onKeyDown(e: KeyboardEvent) {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    const map: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const next = map[e.code];
    if (!next) return;
    const last = dirQueue[dirQueue.length - 1] ?? dir;
    if (next === OPPOSITE[last]) return;
    if (dirQueue.length < 2) dirQueue.push(next);
  }
  let snake: Vec[] = [];
  let dir: Dir = 'right';
  let food: { pos: Vec; kind: (typeof FRUIT_NAMES)[number] };
  let score = 0;
  let level = 1;
  let status: GameStatus = 'playing';
  let stepTime = BASE_STEP;
  let acc = 0;
  let foodsEatenThisLevel = 0;
  let paused = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  function randomEmptyCell(): Vec {
    let pos: Vec;
    do {
      pos = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
    } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
    return pos;
  }
  function spawnFood() {
    food = {
      pos: randomEmptyCell(),
      kind: FRUIT_NAMES[randInt(0, FRUIT_NAMES.length - 1)],
    };
  }
  function initGame() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = [
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
      { x: cx - 3, y: cy },
    ];
    dir = 'right';
    dirQueue = [];
    score = 0;
    level = 1;
    stepTime = BASE_STEP;
    acc = 0;
    foodsEatenThisLevel = 0;
    status = 'playing';
    spawnFood();
  }
  function update(dt: number) {
    if (status === 'gameover') return;
    acc += dt;
    if (acc < stepTime) return;
    acc -= stepTime;
    if (dirQueue.length > 0) dir = dirQueue.shift()!;
    const head = snake[0];
    const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      status = 'gameover';
      return;
    }
    if (snake.some((s) => s.x === next.x && s.y === next.y)) {
      status = 'gameover';
      return;
    }
    snake.unshift(next);
    if (next.x === food.pos.x && next.y === food.pos.y) {
      score += 10 * level;
      foodsEatenThisLevel++;
      if (foodsEatenThisLevel >= FOODS_PER_LEVEL) {
        foodsEatenThisLevel = 0;
        level++;
        stepTime = Math.max(MIN_STEP, BASE_STEP - level * STEP_DECAY);
      }
      spawnFood();
    } else {
      snake.pop();
    }
  }
  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }
  }
  function drawSnake() {
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i];
      const isHead = i === 0;
      ctx.fillStyle = isHead
        ? '#00ff88'
        : `rgba(0, 255, 136, ${0.85 - i * 0.02 > 0.35 ? 0.85 - i * 0.02 : 0.35})`;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = isHead ? 10 : 4;
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      ctx.shadowBlur = 0;
    }
  }
  function drawFood() {
    const rect = SPRITE_ATLAS[food.kind];
    const dw = CELL * 1.6;
    const dh = CELL * 1.6;
    const dx = food.pos.x * CELL + CELL / 2 - dw / 2;
    const dy = food.pos.y * CELL + CELL / 2 - dh / 2;
    if (fruitImg.complete && fruitImg.naturalWidth > 0) {
      ctx.drawImage(fruitImg, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#ff2079';
      ctx.beginPath();
      ctx.arc(
        food.pos.x * CELL + CELL / 2,
        food.pos.y * CELL + CELL / 2,
        CELL / 2.4,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
  function drawHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE  ${score}`, 14, 26);
    ctx.textAlign = 'center';
    ctx.fillText(`NIVEL ${level}`, W / 2, 26);
  }
  function drawOverlay(title: string, sub: string) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 46px monospace';
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(sub, W / 2, H / 2 + 22);
  }
  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawFood();
    drawSnake();
    drawHUD();
    if (status === 'gameover')
      drawOverlay(
        'GAME OVER',
        `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`
      );
  }
  function loop(ts: number) {
    const dt =
      lastTime === null || paused ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) update(dt);
    draw();
    onStateChange({
      score,
      lives: status === 'gameover' ? 0 : 1,
      level,
      gameOver: status === 'gameover',
    });
    rafId = requestAnimationFrame(loop);
  }
  return {
    start() {
      initGame();
      window.addEventListener('keydown', onKeyDown);
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    destroy() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('keydown', onKeyDown);
    },
    setPaused(value: boolean) {
      paused = value;
    },
    restart() {
      initGame();
      lastTime = null;
    },
  };
}
