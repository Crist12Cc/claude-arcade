export interface BloqueBusterState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}
export interface BloqueBusterEngine {
  start(): void;
  destroy(): void;
  setPaused(paused: boolean): void;
  restart(): void;
}
const W = 800;
const H = 600;
const PADDLE_SPEED = 400;
const PADDLE_W = 100;
const PADDLE_H = 14;
const PADDLE_Y = H - 40;
const BALL_SIZE = 12;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const COLOR_HEX: Record<string, string> = {
  red: '#e57373',
  yellow: '#ffd54f',
  cyan: '#4dd0e1',
  magenta: '#ba68c8',
  hotpink: '#f06292',
  green: '#81c784',
};
type BlockDef = { col: number; row: number; color: string };
type LevelDef = { speed: number; blocks: BlockDef[] };
const LEVELS: LevelDef[] = (() => {
  const rowColors1 = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
  const rowColors2 = ['cyan', 'hotpink', 'yellow', 'magenta', 'green', 'red'];
  const rowColors4 = ['cyan', 'magenta', 'green', 'yellow', 'hotpink', 'red'];
  const l1: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      l1.push({ col, row, color: rowColors1[row] });
  const l2: BlockDef[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });
  const l3: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? 'yellow' : 'magenta' });
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });
  const l5: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? 'hotpink' : 'cyan' });
    }
  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();
type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
};
type Status = 'playing' | 'gameover' | 'win';
export function createBloqueBusterEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: BloqueBusterState) => void
): BloqueBusterEngine {
  const ctx = canvas.getContext('2d')!;
  const keys: Record<string, boolean> = {};
  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
    keys[e.code] = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }
  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
  }
  const paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
  let blocks: Block[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let status: Status = 'playing';
  let paused = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  function placeBallOnPaddle() {
    const speed = LEVELS[level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }
  function loadLevel(n: number) {
    level = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    placeBallOnPaddle();
  }
  function initGame() {
    paddle.x = (W - paddle.w) / 2;
    score = 0;
    lives = 3;
    status = 'playing';
    loadLevel(1);
  }
  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }
  function update(dt: number) {
    if (status !== 'playing') return;
    if (keys['ArrowLeft']) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys['ArrowRight'])
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        score += 10;
        ball.vy = -ball.vy;
        if (blocks.every((b) => !b.alive)) {
          if (level < 5) loadLevel(level + 1);
          else status = 'win';
        }
        break;
      }
    }
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        status = 'gameover';
      } else {
        placeBallOnPaddle();
      }
    }
  }
  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    for (const block of blocks) {
      if (!block.alive) continue;
      ctx.fillStyle = COLOR_HEX[block.color] ?? '#9e9e9e';
      ctx.fillRect(block.x, block.y, block.w, block.h);
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.beginPath();
    ctx.fillStyle = '#4dd0e1';
    ctx.arc(
      ball.x + ball.w / 2,
      ball.y + ball.h / 2,
      ball.w / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    if (status === 'gameover' || status === 'win') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 46px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        status === 'win' ? '¡COMPLETASTE EL JUEGO!' : 'GAME OVER',
        W / 2,
        H / 2
      );
    }
  }
  function loop(ts: number) {
    const dt =
      lastTime === null || paused ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) update(dt);
    draw();
    onStateChange({
      score,
      lives,
      level,
      gameOver: status === 'gameover' || status === 'win',
    });
    rafId = requestAnimationFrame(loop);
  }
  return {
    start() {
      initGame();
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('mousemove', onMouseMove);
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    destroy() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
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
