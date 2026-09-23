"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FallingNut = {
  x: number;
  y: number;
  size: number;
  speed: number;
};

type WrenchProjectile = {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  angle: number;
  spinSpeed: number;
  hitsThisShot: number;
  resolved: boolean;
};

type RuntimeState = {
  running: boolean;
  width: number;
  height: number;
  elapsedMs: number;
  nuts: FallingNut[];
  spawnAccumulator: number;
  playerY: number;
  moveUp: boolean;
  moveDown: boolean;
  projectile: WrenchProjectile;
};

const CONFIG = {
  // 可調參數區：每回合起始扳手數量
  startingWrenches: 5,
  // 可調參數區：螺帽基礎掉落速度（像素/秒）
  nutBaseFallSpeed: 94,
  // 可調參數區：螺帽隨時間增加掉落速度（像素/秒）
  nutTimeRampSpeed: 16,
  // 可調參數區：螺帽隨分數增加掉落速度（像素/秒）
  nutScoreRampSpeed: 4,
  // 可調參數區：螺帽生成基礎間隔（秒）
  nutSpawnBaseInterval: 1,
  // 可調參數區：螺帽最小生成間隔（秒）
  nutSpawnMinInterval: 0.3,
  // 可調參數區：螺帽生成隨時間加速係數（秒）
  nutSpawnTimeRamp: 0.028,
  // 可調參數區：螺帽生成隨分數加速係數（秒）
  nutSpawnScoreRamp: 0.011,
  // 可調參數區：螺帽像素尺寸
  nutSize: 24,
  // 可調參數區：扳手上下移動速度（像素/秒）
  wrenchMoveSpeed: 290,
  // 可調參數區：扳手飛行速度（像素/秒）
  projectileSpeed: 490,
  // 可調參數區：扳手旋轉速度（弧度/秒）
  projectileSpinSpeed: 8.4,
  // 可調參數區：右側扳手活動區寬度比例
  wrenchZoneRatio: 0.2,
  // 可調參數區：左側螺帽掉落區寬度比例
  nutZoneRatio: 0.25,
  // 可調參數區：連擊字樣顯示時間（毫秒）
  comboBannerMs: 900,
};

function createRuntime(width: number, height: number): RuntimeState {
  return {
    running: true,
    width,
    height,
    elapsedMs: 0,
    nuts: [],
    spawnAccumulator: 0,
    playerY: Math.round(height * 0.5),
    moveUp: false,
    moveDown: false,
    projectile: {
      active: false,
      x: 0,
      y: 0,
      width: 68,
      height: 30,
      speed: CONFIG.projectileSpeed,
      angle: 0,
      spinSpeed: CONFIG.projectileSpinSpeed,
      hitsThisShot: 0,
      resolved: false,
    },
  };
}

function getComboLabel(hits: number): string {
  if (hits <= 1) return "";
  if (hits === 2) return "DOUBLE KILL";
  if (hits === 3) return "TRIPLE KILL";
  return `${hits}X KILL`;
}

function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function drawNut(ctx: CanvasRenderingContext2D, nut: FallingNut) {
  const size = Math.round(nut.size);
  const x = Math.round(nut.x);
  const y = Math.round(nut.y);
  const rim = Math.max(2, Math.floor(size * 0.12));
  const hole = Math.max(6, Math.floor(size * 0.34));

  ctx.fillStyle = "#111111";
  ctx.fillRect(x, y + rim, size, size - rim * 2);
  ctx.fillRect(x + rim, y, size - rim * 2, size);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + rim * 2, y + rim * 2, size - rim * 4, size - rim * 4);

  ctx.fillStyle = "#111111";
  ctx.fillRect(x + Math.round((size - hole) / 2), y + Math.round((size - hole) / 2), hole, hole);
}

function drawWrench(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const px = Math.round(x);
  const py = Math.round(y);
  const w = Math.round(width);
  const h = Math.round(height);

  const handleW = Math.round(w * 0.58);
  const headW = w - handleW;
  const bodyTop = py + Math.round(h * 0.2);
  const bodyH = Math.round(h * 0.6);

  ctx.fillStyle = "#111111";
  ctx.fillRect(px + headW, bodyTop, handleW, bodyH);
  ctx.fillRect(px, py + Math.round(h * 0.34), headW + 6, Math.round(h * 0.32));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px + headW + 2, bodyTop + 2, Math.max(2, handleW - 6), Math.max(2, bodyH - 4));

  ctx.fillStyle = "#111111";
  ctx.fillRect(px + headW + Math.round(handleW * 0.72), py + Math.round(h * 0.39), Math.round(h * 0.22), Math.round(h * 0.22));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px + 2, py + Math.round(h * 0.22), headW - 2, Math.round(h * 0.56));

  ctx.fillStyle = "#111111";
  ctx.fillRect(px + 2, py + Math.round(h * 0.42), Math.round(headW * 0.34), Math.round(h * 0.16));
  ctx.fillRect(px + Math.round(headW * 0.52), py + Math.round(h * 0.42), Math.round(headW * 0.34), Math.round(h * 0.16));
}

export default function HomepageCornerWrench() {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [wrenchesLeft, setWrenchesLeft] = useState(CONFIG.startingWrenches);
  const [comboLabel, setComboLabel] = useState("");
  const [finished, setFinished] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const comboTimerRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const wrenchesRef = useRef(CONFIG.startingWrenches);
  const runtimeRef = useRef<RuntimeState>(createRuntime(960, 540));
  const prevTsRef = useRef(0);
  const bodyOverflowRef = useRef("");

  const closeOverlay = useCallback(() => {
    setOpen(false);
  }, []);

  const resetRound = useCallback(() => {
    runtimeRef.current = createRuntime(960, 540);
    scoreRef.current = 0;
    wrenchesRef.current = CONFIG.startingWrenches;
    setScore(0);
    setWrenchesLeft(CONFIG.startingWrenches);
    setComboLabel("");
    setFinished(false);
    prevTsRef.current = 0;
  }, []);

  const spawnNut = useCallback((runtime: RuntimeState) => {
    const size = CONFIG.nutSize;
    const maxX = Math.floor(runtime.width * CONFIG.nutZoneRatio) - size - 8;
    const minX = 8;
    const x = Math.max(minX, Math.floor(Math.random() * Math.max(1, maxX - minX + 1)) + minX);
    const rampByTime = (runtime.elapsedMs / 1000 / 30) * CONFIG.nutTimeRampSpeed;
    const rampByScore = scoreRef.current * CONFIG.nutScoreRampSpeed;
    const speed = CONFIG.nutBaseFallSpeed + rampByTime + rampByScore + Math.random() * 36;
    runtime.nuts.push({ x, y: -size - 10, size, speed });
  }, []);

  const resolveShot = useCallback(() => {
    const runtime = runtimeRef.current;
    const projectile = runtime.projectile;
    if (projectile.resolved) return;
    projectile.resolved = true;

    const hits = projectile.hitsThisShot;
    if (hits > 0) {
      const gained = hits * hits;
      scoreRef.current += gained;
      setScore(scoreRef.current);
      const label = getComboLabel(hits);
      if (label) {
        setComboLabel(label);
        if (comboTimerRef.current !== null) {
          window.clearTimeout(comboTimerRef.current);
        }
        comboTimerRef.current = window.setTimeout(() => {
          setComboLabel("");
        }, CONFIG.comboBannerMs);
      }
      return;
    }

    wrenchesRef.current -= 1;
    setWrenchesLeft(wrenchesRef.current);
    if (wrenchesRef.current <= 0) {
      runtime.running = false;
      setFinished(true);
    }
  }, []);

  const fireProjectile = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime.running || finished) return;
    const projectile = runtime.projectile;
    if (projectile.active) return;

    const x = Math.floor(runtime.width * (1 - CONFIG.wrenchZoneRatio / 2));
    const y = Math.round(runtime.playerY - projectile.height / 2);
    runtime.projectile = {
      ...projectile,
      active: true,
      x,
      y,
      angle: 0,
      hitsThisShot: 0,
      resolved: false,
    };
  }, [finished]);

  const tick = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const runtime = runtimeRef.current;
    if (!runtime.running && !finished) return;

    if (prevTsRef.current === 0) {
      prevTsRef.current = timestamp;
    }
    const deltaMs = Math.min(40, timestamp - prevTsRef.current);
    prevTsRef.current = timestamp;
    const dt = deltaMs / 1000;

    runtime.elapsedMs += deltaMs;
    const playerMinY = 36;
    const playerMaxY = runtime.height - 36;

    if (runtime.moveUp) runtime.playerY -= CONFIG.wrenchMoveSpeed * dt;
    if (runtime.moveDown) runtime.playerY += CONFIG.wrenchMoveSpeed * dt;
    runtime.playerY = Math.max(playerMinY, Math.min(playerMaxY, runtime.playerY));

    const spawnInterval = Math.max(
      CONFIG.nutSpawnMinInterval,
      CONFIG.nutSpawnBaseInterval -
        (runtime.elapsedMs / 1000 / 18) * CONFIG.nutSpawnTimeRamp -
        scoreRef.current * CONFIG.nutSpawnScoreRamp
    );
    runtime.spawnAccumulator += dt;
    while (runtime.spawnAccumulator >= spawnInterval && runtime.running) {
      runtime.spawnAccumulator -= spawnInterval;
      spawnNut(runtime);
    }

    runtime.nuts.forEach((nut) => {
      nut.y += nut.speed * dt;
    });
    runtime.nuts = runtime.nuts.filter((nut) => nut.y < runtime.height + nut.size + 12);

    const projectile = runtime.projectile;
    if (projectile.active) {
      projectile.x -= projectile.speed * dt;
      projectile.angle += projectile.spinSpeed * dt;
      projectile.y = runtime.playerY - projectile.height / 2;

      const projectileBox = {
        x: projectile.x,
        y: projectile.y,
        w: projectile.width,
        h: projectile.height,
      };
      runtime.nuts = runtime.nuts.filter((nut) => {
        const nutBox = { x: nut.x, y: nut.y, w: nut.size, h: nut.size };
        const hit = intersects(projectileBox, nutBox);
        if (hit) projectile.hitsThisShot += 1;
        return !hit;
      });

      if (projectile.x + projectile.width < -20) {
        projectile.active = false;
        resolveShot();
      }
    }

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#f9f9f9";
    ctx.fillRect(0, 0, runtime.width, runtime.height);

    runtime.nuts.forEach((nut) => drawNut(ctx, nut));

    const playerWidth = 74;
    const playerHeight = 34;
    const playerX = Math.floor(runtime.width * (1 - CONFIG.wrenchZoneRatio / 2)) - playerWidth / 2;
    const playerY = runtime.playerY - playerHeight / 2;

    if (!projectile.active) {
      drawWrench(ctx, playerX, playerY, playerWidth, playerHeight);
    } else {
      ctx.save();
      const cx = runtime.projectile.x + runtime.projectile.width / 2;
      const cy = runtime.projectile.y + runtime.projectile.height / 2;
      ctx.translate(Math.round(cx), Math.round(cy));
      ctx.rotate(runtime.projectile.angle);
      drawWrench(
        ctx,
        -runtime.projectile.width / 2,
        -runtime.projectile.height / 2,
        runtime.projectile.width,
        runtime.projectile.height
      );
      ctx.restore();
    }

    frameRef.current = window.requestAnimationFrame(tick);
  }, [finished, resolveShot, spawnNut]);

  useEffect(() => {
    if (!open) return;

    resetRound();
    const canvas = canvasRef.current;
    if (!canvas) return;

    bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusCanvas = window.setTimeout(() => {
      canvas.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        runtimeRef.current.moveUp = true;
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        runtimeRef.current.moveDown = true;
      } else if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        fireProjectile();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") runtimeRef.current.moveUp = false;
      if (event.key === "ArrowDown") runtimeRef.current.moveDown = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(focusCanvas);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.body.style.overflow = bodyOverflowRef.current;
      runtimeRef.current.moveUp = false;
      runtimeRef.current.moveDown = false;
      runtimeRef.current.running = false;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      if (comboTimerRef.current !== null) {
        window.clearTimeout(comboTimerRef.current);
      }
      comboTimerRef.current = null;
      setComboLabel("");
    };
  }, [closeOverlay, fireProjectile, open, resetRound, tick]);

  return (
    <>
      <button
        type="button"
        title="維護工具"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-20 p-1 rounded border border-themed bg-card/80 hover:bg-surface transition-colors cursor-pointer"
        aria-label="開啟維護工具"
      >
        <svg viewBox="0 0 64 64" width={18} height={18} aria-hidden="true">
          <path
            d="M20 14l8 8-7 7 12 12 7-7 8 8-7 7c-3 3-7 3-10 0L17 34c-3-3-3-7 0-10z"
            fill="#353535"
            stroke="#111111"
            strokeWidth="2.5"
          />
          <circle cx="49" cy="15" r="7" fill="#444444" stroke="#111111" strokeWidth="2.5" />
          <circle cx="49" cy="15" r="2.2" fill="#f9f9f9" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center px-3 py-4">
          <button
            type="button"
            title="關閉（Esc）"
            onClick={closeOverlay}
            className="absolute right-4 top-4 text-white text-3xl leading-none cursor-pointer hover:text-gray-300"
            aria-label="關閉視窗"
          >
            ×
          </button>

          <div className="relative w-full max-w-[1020px] mx-auto">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              tabIndex={0}
              onMouseDown={fireProjectile}
              className="w-full h-auto max-h-[82vh] border border-slate-500 bg-[#f9f9f9] outline-none"
              aria-label="互動畫布"
            />

            <div className="pointer-events-none absolute left-3 top-3 text-black font-mono text-sm sm:text-base">
              <div>SCORE: {score}</div>
              <div>WRENCH: {wrenchesLeft}</div>
            </div>

            {comboLabel && !finished && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-black text-2xl sm:text-4xl font-bold tracking-wider">{comboLabel}</div>
              </div>
            )}

            {finished && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <div className="w-[88%] max-w-[420px] rounded border border-black bg-white px-6 py-7 text-center text-black">
                  <h2 className="text-2xl font-bold mb-2">ROUND OVER</h2>
                  <p className="text-base mb-6">SCORE: {score}</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      type="button"
                      onClick={resetRound}
                      className="px-4 py-2 rounded border border-black text-black hover:bg-slate-100 cursor-pointer"
                    >
                      再來一次
                    </button>
                    <button
                      type="button"
                      onClick={closeOverlay}
                      className="px-4 py-2 rounded border border-black text-black hover:bg-slate-100 cursor-pointer"
                    >
                      關閉
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 mt-5">↑/↓ 移動，空白鍵或滑鼠發射，Esc 關閉</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
