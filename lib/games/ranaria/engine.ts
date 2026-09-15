export interface RanariaState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}
export interface SkinOption {
  id: string;
  label: string;
}
export interface RanariaEngine {
  start(): void;
  destroy(): void;
  setPaused(paused: boolean): void;
  restart(): void;
  getSkins(): SkinOption[];
  getSkin(): string;
  setSkin(skin: string): void;
}
const W = 800;
const H = 600;
const CELL = 50;
const COLS = W / CELL;
const ROWS = H / CELL;
const ROW_GOALS = 0;
const RIVER_ROWS = [1, 2, 3, 4, 5];
const ROW_SAFE = 6;
const ROAD_ROWS = [7, 8, 9, 10];
const ROW_START = 11;
const START_COL = 7;
const JUMP_MS = 120;
const ROUND_TIME_MS = 15000;
const GOALS: { col: number; width: number }[] = [
  { col: 1, width: 2 },
  { col: 4, width: 2 },
  { col: 7, width: 2 },
  { col: 10, width: 2 },
  { col: 13, width: 2 },
];
type Direction = 'up' | 'down' | 'left' | 'right';
type EntityType = 'car' | 'truck' | 'log' | 'turtle';
interface Entity {
  col: number;
  width: number;
  type: EntityType;
  submerged?: boolean;
  submergeT?: number;
}
interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}
interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
}
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
type SkinId = 'classic' | 'retro' | 'neon';
const SKIN_ORDER: SkinId[] = ['classic', 'retro', 'neon'];
const SKIN_LABELS: Record<SkinId, string> = {
  classic: 'CLÁSICO',
  retro: 'RETRO',
  neon: 'NEÓN',
};
interface Skin {
  boardBg: string | null;
  zoneGoal: string;
  zoneRiver: string;
  zoneSafe: string;
  zoneRoad: string;
  goalEmpty: string;
  goalFilled: string;
  goalStroke: string;
  goalFrog: string;
  car: string;
  truck: string;
  wheel: string;
  log: string;
  logStroke: string;
  turtle: string;
  turtleSubmerged: string;
  frog: string;
  hudText: string;
  glow: boolean;
}
const SKINS: Record<SkinId, Skin> = {
  classic: {
    boardBg: null,
    zoneGoal: '#062d1c',
    zoneRiver: '#031a33',
    zoneSafe: '#0a2510',
    zoneRoad: '#0a0a0a',
    goalEmpty: '#0a3a20',
    goalFilled: '#0f5c33',
    goalStroke: '#ffd60a',
    goalFrog: '#00ff88',
    car: '#ff2079',
    truck: '#8a8a8a',
    wheel: '#000',
    log: '#7a4a26',
    logStroke: '#4a2c14',
    turtle: '#00b478',
    turtleSubmerged: 'rgba(0,180,120,0.25)',
    frog: '#39ff14',
    hudText: '#fff',
    glow: false,
  },
  retro: {
    boardBg: '#12140f',
    zoneGoal: '#1c3a2b',
    zoneRiver: '#1a2f4a',
    zoneSafe: '#233d1f',
    zoneRoad: '#26221c',
    goalEmpty: '#2c5c3f',
    goalFilled: '#3f8f5f',
    goalStroke: '#f7d51d',
    goalFrog: '#8fd98f',
    car: '#c1272d',
    truck: '#9c9c8f',
    wheel: '#1a1a16',
    log: '#8a5a34',
    logStroke: '#5a381e',
    turtle: '#4caf50',
    turtleSubmerged: 'rgba(76,175,80,0.3)',
    frog: '#7cc36b',
    hudText: '#f2e9d8',
    glow: false,
  },
  neon: {
    boardBg: '#000000',
    zoneGoal: '#001a12',
    zoneRiver: '#00081a',
    zoneSafe: '#000f05',
    zoneRoad: '#050505',
    goalEmpty: '#001f10',
    goalFilled: '#00ff9c',
    goalStroke: '#00fff9',
    goalFrog: '#00fff9',
    car: '#ff00e6',
    truck: '#2979ff',
    wheel: '#000',
    log: '#ff9100',
    logStroke: '#ffb84d',
    turtle: '#00ff66',
    turtleSubmerged: 'rgba(0,255,102,0.2)',
    frog: '#faff00',
    hudText: '#00fff9',
    glow: true,
  },
};
const SKIN_STORAGE_KEY = 'ranaria-skin';
function loadSkin(): SkinId {
  if (typeof window === 'undefined') return 'classic';
  const stored = window.localStorage.getItem(SKIN_STORAGE_KEY);
  return SKIN_ORDER.includes(stored as SkinId) ? (stored as SkinId) : 'classic';
}
function saveSkin(skin: SkinId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SKIN_STORAGE_KEY, skin);
}
export function createRanariaEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: RanariaState) => void
): RanariaEngine {
  const ctx = canvas.getContext('2d')!;
  const CAPTURED_CODES = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
  ]);
  let pendingDir: Direction | null = null;
  function onKeyDown(e: KeyboardEvent) {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    const map: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const next = map[e.code];
    if (next) pendingDir = next;
  }
  let lanes: Lane[] = [];
  let goalsFilled: boolean[] = [];
  let frog: Frog;
  let minRowReached = ROW_START;
  let timeLeft = ROUND_TIME_MS;
  let score = 0;
  let lives = 3;
  let level = 1;
  let gameOver = false;
  let paused = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let skin: SkinId = loadSkin();
  function buildLanes(lvl: number): Lane[] {
    const scale = Math.pow(1.15, lvl - 1);
    const out: Lane[] = [];
    ROAD_ROWS.forEach((row, i) => {
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const speed = rand(24, 50) * scale;
      const entities: Entity[] = [];
      let col = randInt(0, 3);
      while (col < COLS + 4) {
        const width = randInt(1, 3);
        entities.push({
          col,
          width,
          type: width >= 3 ? 'truck' : 'car',
        });
        col += width + randInt(2, 4);
      }
      out.push({ row, speed, dir, entities });
    });
    RIVER_ROWS.forEach((row, i) => {
      const dir: 1 | -1 = i % 2 === 0 ? -1 : 1;
      const speed = rand(16, 36) * scale;
      const entities: Entity[] = [];
      let col = randInt(0, 3);
      const isTurtleLane = i % 2 === 1;
      while (col < COLS + 4) {
        if (isTurtleLane) {
          const groupSize = randInt(2, 3);
          entities.push({
            col,
            width: groupSize,
            type: 'turtle',
            submerged: false,
            submergeT: rand(0, 3000),
          });
          col += groupSize + randInt(2, 4);
        } else {
          const width = randInt(2, 4);
          entities.push({ col, width, type: 'log' });
          col += width + randInt(2, 4);
        }
      }
      out.push({ row, speed, dir, entities });
    });
    return out;
  }
  function resetFrog() {
    frog = {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: START_COL,
      fromRow: ROW_START,
      targetCol: START_COL,
      targetRow: ROW_START,
    };
    minRowReached = ROW_START;
    timeLeft = Math.max(6000, ROUND_TIME_MS - (level - 1) * 800);
  }
  function initGame() {
    score = 0;
    lives = 3;
    level = 1;
    gameOver = false;
    goalsFilled = GOALS.map(() => false);
    lanes = buildLanes(level);
    resetFrog();
  }
  function laneAt(row: number): Lane | undefined {
    return lanes.find((l) => l.row === row);
  }
  function checkRoadCollision(): boolean {
    const lane = laneAt(frog.row);
    if (!lane) return false;
    return lane.entities.some(
      (e) => frog.col >= e.col && frog.col < e.col + e.width
    );
  }
  function getSupport(): Entity | null {
    const lane = laneAt(frog.row);
    if (!lane) return null;
    const e = lane.entities.find(
      (ent) => frog.col >= ent.col && frog.col < ent.col + ent.width
    );
    if (!e) return null;
    if (e.type === 'turtle' && e.submerged) return null;
    return e;
  }
  function killFrog() {
    lives -= 1;
    onStateChange({ score, lives: Math.max(lives, 0), level, gameOver: false });
    if (lives <= 0) {
      gameOver = true;
      onStateChange({ score, lives: 0, level, gameOver: true });
      return;
    }
    resetFrog();
  }
  function completeRound() {
    score += 200;
    level += 1;
    lanes = buildLanes(level);
    goalsFilled = GOALS.map(() => false);
    resetFrog();
  }
  function resolveLanding() {
    if (frog.row === ROW_GOALS) {
      const idx = GOALS.findIndex(
        (g) => frog.col >= g.col && frog.col < g.col + g.width
      );
      if (idx === -1 || goalsFilled[idx]) {
        killFrog();
        return;
      }
      goalsFilled[idx] = true;
      score += 50 + Math.floor(timeLeft / 1000) * 10;
      if (goalsFilled.every(Boolean)) completeRound();
      else resetFrog();
      return;
    }
    if (ROAD_ROWS.includes(frog.row) && checkRoadCollision()) {
      killFrog();
      return;
    }
    if (RIVER_ROWS.includes(frog.row) && !getSupport()) {
      killFrog();
      return;
    }
    if (frog.row < minRowReached) {
      score += 10 * (minRowReached - frog.row);
      minRowReached = frog.row;
    }
  }
  function tryMove(dir: Direction) {
    let { col, row } = frog;
    if (dir === 'up') row -= 1;
    else if (dir === 'down') row += 1;
    else if (dir === 'left') col -= 1;
    else col += 1;
    if (col < 0 || col >= COLS || row < 0 || row > ROW_START) return;
    frog.fromCol = frog.col;
    frog.fromRow = frog.row;
    frog.targetCol = col;
    frog.targetRow = row;
    frog.animating = true;
    frog.animT = 0;
  }
  function update(dt: number) {
    if (gameOver) return;
    for (const lane of lanes) {
      for (const e of lane.entities) {
        e.col += (lane.dir * lane.speed * dt) / CELL;
        if (lane.dir === 1 && e.col > COLS + 4) e.col = -e.width - 4;
        if (lane.dir === -1 && e.col < -e.width - 4) e.col = COLS + 4;
        if (e.type === 'turtle') {
          e.submergeT = (e.submergeT ?? 0) + dt * 1000;
          const cycle = e.submergeT % 4500;
          e.submerged = cycle >= 3000;
        }
      }
    }
    if (frog.animating) {
      frog.animT += dt * 1000;
      if (frog.animT >= JUMP_MS) {
        frog.animating = false;
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        resolveLanding();
      }
    } else {
      if (pendingDir) {
        tryMove(pendingDir);
        pendingDir = null;
      }
      if (!frog.animating && RIVER_ROWS.includes(frog.row)) {
        const support = getSupport();
        if (support) {
          const lane = laneAt(frog.row)!;
          frog.col += (lane.dir * lane.speed * dt) / CELL;
          if (frog.col < 0 || frog.col >= COLS) {
            killFrog();
            return;
          }
        } else {
          killFrog();
          return;
        }
      }
    }
    if (!gameOver) {
      timeLeft -= dt * 1000;
      if (timeLeft <= 0) {
        killFrog();
        return;
      }
    }
    onStateChange({ score, lives: Math.max(lives, 0), level, gameOver });
  }
  function zoneColor(row: number): string {
    const s = SKINS[skin];
    if (row === ROW_GOALS) return s.zoneGoal;
    if (RIVER_ROWS.includes(row)) return s.zoneRiver;
    if (row === ROW_SAFE || row === ROW_START) return s.zoneSafe;
    return s.zoneRoad;
  }
  function withGlow(color: string, blur: number) {
    const s = SKINS[skin];
    if (s.glow) {
      ctx.shadowBlur = blur;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 0;
    }
  }
  function drawBackground() {
    const s = SKINS[skin];
    if (s.boardBg) {
      ctx.fillStyle = s.boardBg;
      ctx.fillRect(0, 0, W, H);
    }
    for (let r = 0; r < ROWS; r++) {
      ctx.fillStyle = zoneColor(r);
      ctx.fillRect(0, r * CELL, W, CELL);
    }
    GOALS.forEach((g, i) => {
      ctx.fillStyle = goalsFilled[i] ? s.goalFilled : s.goalEmpty;
      ctx.fillRect(g.col * CELL, 0, g.width * CELL, CELL);
      withGlow(s.goalStroke, 8);
      ctx.strokeStyle = s.goalStroke;
      ctx.strokeRect(g.col * CELL + 2, 2, g.width * CELL - 4, CELL - 4);
      ctx.shadowBlur = 0;
      if (goalsFilled[i]) {
        ctx.fillStyle = s.goalFrog;
        ctx.beginPath();
        ctx.ellipse(
          g.col * CELL + (g.width * CELL) / 2,
          CELL / 2,
          12,
          9,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });
  }
  function drawEntities() {
    const s = SKINS[skin];
    for (const lane of lanes) {
      for (const e of lane.entities) {
        const x = e.col * CELL;
        const y = lane.row * CELL;
        if (e.type === 'car' || e.type === 'truck') {
          const color = e.type === 'truck' ? s.truck : s.car;
          withGlow(color, 10);
          ctx.fillStyle = color;
          ctx.fillRect(x + 2, y + 8, e.width * CELL - 4, CELL - 16);
          if (s.glow) {
            ctx.strokeStyle = color;
            ctx.strokeRect(x + 2, y + 8, e.width * CELL - 4, CELL - 16);
          }
          ctx.shadowBlur = 0;
          if (!s.glow) {
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(x + 2, y + 8, e.width * CELL - 4, 4);
          }
          ctx.fillStyle = s.wheel;
          for (let w = 0; w < e.width; w++) {
            ctx.beginPath();
            ctx.arc(x + w * CELL + 12, y + CELL - 10, 6, 0, Math.PI * 2);
            ctx.arc(x + w * CELL + CELL - 12, y + CELL - 10, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (e.type === 'log') {
          withGlow(s.log, 8);
          ctx.fillStyle = s.log;
          ctx.fillRect(x + 2, y + 10, e.width * CELL - 4, CELL - 20);
          ctx.shadowBlur = 0;
          if (!s.glow) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x + 2, y + 10, e.width * CELL - 4, 4);
          }
          ctx.strokeStyle = s.logStroke;
          for (let w = 1; w < e.width; w++) {
            ctx.beginPath();
            ctx.moveTo(x + w * CELL, y + 10);
            ctx.lineTo(x + w * CELL, y + CELL - 10);
            ctx.stroke();
          }
        } else {
          const color = e.submerged ? s.turtleSubmerged : s.turtle;
          withGlow(color, 8);
          ctx.fillStyle = color;
          for (let w = 0; w < e.width; w++) {
            ctx.beginPath();
            ctx.ellipse(
              x + w * CELL + CELL / 2,
              y + CELL / 2,
              CELL / 2 - 4,
              CELL / 2 - 10,
              0,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
          ctx.shadowBlur = 0;
        }
      }
    }
  }
  function drawFrog() {
    const s = SKINS[skin];
    let dx = frog.col * CELL;
    let dy = frog.row * CELL;
    if (frog.animating) {
      const t = Math.min(frog.animT / JUMP_MS, 1);
      dx = (frog.fromCol + (frog.targetCol - frog.fromCol) * t) * CELL;
      dy = (frog.fromRow + (frog.targetRow - frog.fromRow) * t) * CELL;
    }
    const cx = dx + CELL / 2;
    const cy = dy + CELL / 2;
    withGlow(s.frog, 14);
    ctx.fillStyle = s.frog;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 16, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 8, 3, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 8, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawHUD() {
    const s = SKINS[skin];
    ctx.fillStyle = s.hudText;
    ctx.font = '15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE  ${score}`, 14, 26);
    ctx.textAlign = 'center';
    ctx.fillText(`NIVEL ${level}`, W / 2, 26);
    ctx.textAlign = 'right';
    ctx.fillText('♥'.repeat(Math.max(lives, 0)), W - 14, 26);
    const pct = Math.max(0, timeLeft / ROUND_TIME_MS);
    ctx.fillStyle = pct > 0.5 ? s.frog : pct > 0.25 ? s.goalStroke : s.car;
    ctx.fillRect(0, 0, W * pct, 4);
  }
  function drawOverlay() {
    const s = SKINS[skin];
    ctx.textAlign = 'center';
    ctx.fillStyle = s.hudText;
    ctx.font = 'bold 46px monospace';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 18);
    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(
      `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`,
      W / 2,
      H / 2 + 22
    );
  }
  function draw() {
    drawBackground();
    drawEntities();
    drawFrog();
    drawHUD();
    if (gameOver) drawOverlay();
  }
  function loop(ts: number) {
    const dt =
      lastTime === null || paused ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) update(dt);
    draw();
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
