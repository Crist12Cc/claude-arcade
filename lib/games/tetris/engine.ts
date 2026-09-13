export interface TetrisState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}
export interface SkinOption {
  id: string;
  label: string;
}
export interface TetrisEngine {
  start(): void;
  destroy(): void;
  setPaused(paused: boolean): void;
  restart(): void;
  getSkins(): SkinOption[];
  getSkin(): string;
  setSkin(skin: string): void;
}
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = COLS * BLOCK;
const H = ROWS * BLOCK;
type SkinId = 'neon' | 'retro' | 'clasico';
const SKIN_ORDER: SkinId[] = ['clasico', 'neon', 'retro'];
const SKIN_LABELS: Record<SkinId, string> = {
  clasico: 'CLÁSICO',
  neon: 'NEÓN',
  retro: 'RETRO',
};
const PALETTES: Record<SkinId, (string | null)[]> = {
  clasico: [
    null,
    '#4dd0e1', // I - cyan
    '#ffd54f', // O - yellow
    '#ba68c8', // T - purple
    '#81c784', // S - green
    '#e57373', // Z - red
    '#90caf9', // J - pale blue
    '#ffb74d', // L - orange
    '#9e9e9e', // N - tuerca
  ],
  neon: [
    null,
    '#00fff9', // I
    '#faff00', // O
    '#ff00e6', // T
    '#00ff66', // S
    '#ff0033', // Z
    '#2979ff', // J
    '#ff9100', // L
    '#e0e0e0', // N
  ],
  retro: [
    null,
    '#4e7cff', // I
    '#f7d51d', // O
    '#7d3ac1', // T
    '#4caf50', // S
    '#c1272d', // Z
    '#8e6bb0', // J
    '#e07b39', // L
    '#8d8d8d', // N
  ],
};
const BOARD_BG: Record<SkinId, string> = {
  clasico: '#000',
  neon: '#08010f',
  retro: '#1a1410',
};
const GRID_LINE: Record<SkinId, string> = {
  clasico: 'rgba(255,255,255,0.08)',
  neon: 'rgba(0,255,249,0.15)',
  retro: 'rgba(247,213,29,0.12)',
};
const SKIN_STORAGE_KEY = 'tetris-skin';
function loadSkin(): SkinId {
  if (typeof window === 'undefined') return 'clasico';
  const stored = window.localStorage.getItem(SKIN_STORAGE_KEY);
  return SKIN_ORDER.includes(stored as SkinId) ? (stored as SkinId) : 'clasico';
}
function saveSkin(skin: SkinId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SKIN_STORAGE_KEY, skin);
}
const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [2, 2],
    [2, 2],
  ],
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ],
];
const LINE_SCORES = [0, 100, 300, 500, 800];
type Piece = { type: number; shape: number[][]; x: number; y: number };
export function createTetrisEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: TetrisState) => void
): TetrisEngine {
  const ctx = canvas.getContext('2d')!;
  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let paused = false;
  let gameOver = false;
  let dropAccum = 0;
  let dropInterval = 1000;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let skin: SkinId = loadSkin();
  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }
  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }
  function collide(shape: number[][], ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }
  function rotateCW(shape: number[][]) {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }
  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }
  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }
  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }
  function ghostY() {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }
  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }
  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }
  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      gameOver = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  }
  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }
  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number
  ) {
    if (!colorIndex) return;
    const color = PALETTES[skin][colorIndex]!;
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }
  function drawGrid() {
    ctx.strokeStyle = GRID_LINE[skin];
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }
  function draw() {
    ctx.fillStyle = BOARD_BG[skin];
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            0.2
          );
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK
        );
  }
  function onKeyDown(e: KeyboardEvent) {
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(
        e.code
      )
    ) {
      e.preventDefault();
    }
    if (paused || gameOver) return;
    switch (e.code) {
      case 'ArrowLeft':
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case 'ArrowRight':
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case 'ArrowDown':
        softDrop();
        break;
      case 'ArrowUp':
      case 'KeyX':
        tryRotate();
        break;
      case 'Space':
        hardDrop();
        break;
    }
  }
  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    next = randomPiece();
    spawn();
  }
  function loop(ts: number) {
    const dt = lastTime === null || paused ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    if (!paused && !gameOver) {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) {
          current.y++;
        } else {
          lockPiece();
        }
      }
    }
    draw();
    onStateChange({ score, lives: 1, level, gameOver });
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
    getSkins() {
      return SKIN_ORDER.map((id) => ({ id, label: SKIN_LABELS[id] }));
    },
    getSkin() {
      return skin;
    },
    setSkin(value: string) {
      if (!SKIN_ORDER.includes(value as SkinId)) return;
      skin = value as SkinId;
      saveSkin(skin);
    },
  };
}
