const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const playerHpBar = document.getElementById("playerHpBar");
const playerHpText = document.getElementById("playerHpText");
const chargeBar = document.getElementById("chargeBar");
const phaseText = document.getElementById("phaseText");
const phaseBadge = document.getElementById("phaseBadge");
const bossRow = document.getElementById("bossRow");
const bossHpBar = document.getElementById("bossHpBar");
const bossHpText = document.getElementById("bossHpText");
const message = document.getElementById("message");

const keys = { ArrowLeft: false, ArrowRight: false, Space: false };


const SPRITES = {
  player: [
    "...1111...",
    "..111111..",
    ".11144111.",
    "1111111111",
    "11.1111.11",
    ".11.11.11.",
  ],
  enemy: [
    ".22..22.",
    "22222222",
    "22.22.22",
    "22222222",
    ".2.22.2.",
    "2......2",
  ],
  boss: [
    "...3333333333...",
    "..333333333333..",
    ".3333.33.33.333.",
    "3333333333333333",
    "33.3333333333.33",
    "3333344444443333",
    "3333444444443333",
    ".33333.44.33333.",
    "..33..3..3..33..",
    "...3........3...",
  ],
};

const state = {
  running: false,
  paused: false,
  gameOver: false,
  victory: false,
  phase: 1,
  maxPhase: 25,
  lastTime: 0,
  phaseIntro: 1.2,
  screenShake: 0,
  player: null,
  enemies: [],
  enemyBullets: [],
  playerBullets: [],
  particles: [],
  stars: [],
  bosses: [],
};

function makePlayer() {
  return {
    x: canvas.width / 2,
    y: canvas.height - 55,
    w: 24,
    h: 15,
    hitW: 14,
    hitH: 8,
    speed: 520,
    vx: 0,
    hp: 100,
    maxHp: 100,
    shotCd: 0,
    charge: 0,
    maxCharge: 2,
    chargeHeld: false,
    pendingChargeShots: 0,
    pendingChargeDelay: 0,
    pendingChargeRatio: 0,
    invuln: 0,
  };
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.victory = false;
  state.phase = 1;
  state.phaseIntro = 1.2;
  state.screenShake = 0;
  state.enemies = [];
  state.enemyBullets = [];
  state.playerBullets = [];
  state.particles = [];
  state.bosses = [];
  state.player = makePlayer();

  state.stars = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    s: Math.random() * 2 + 1,
    v: Math.random() * 24 + 10,
  }));

  spawnPhase(state.phase);
  message.textContent = "";
}

function spawnBurst(x, y, color, count = 12, speed = 180, life = 0.4) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const spd = speed * (0.55 + Math.random() * 0.85);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life,
      maxLife: life,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}


function getEnemyBulletSpeed(phase) {
  return 260 + phase * 6;
}

function spawnPhase(phase) {
  state.enemies = [];
  state.enemyBullets = [];
  state.playerBullets = [];
  state.bosses = [];

  const isBoss = phase % 5 === 0;
  if (isBoss) {
    const bossHpTable = { 5: 1000, 10: 5000, 15: 10000, 20: 8000, 25: 20000 };
    const hp = bossHpTable[phase] || (300 + phase * 55);
    const bossBase = {
      y: 100,
      w: 210,
      h: 96,
      hp,
      maxHp: hp,
      vx: 190,
      fireCd: 0.5,
      volleyCd: 1.25,
      phase,
      burstCd: 0.7,
      deadFx: false,
    };

    if (phase === 20) {
      state.bosses = [
        { ...bossBase, x: canvas.width * 0.32 },
        { ...bossBase, x: canvas.width * 0.68, vx: -190 },
      ];
    } else {
      state.bosses = [{ ...bossBase, x: canvas.width / 2 }];
    }
  } else {
    const cols = 8;
    const maxRows = 6;
    const enemyCount = Math.min(cols * maxRows, 18 + phase * 2);
    const spacingX = 50;
    const spacingY = 44;
    const totalW = (cols - 1) * spacingX;
    const startX = canvas.width / 2 - totalW / 2;

    for (let i = 0; i < enemyCount; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const moveSpeed = 32 + phase * 3 + Math.random() * 26;
      const moveAngle = Math.random() * Math.PI * 2;
      state.enemies.push({
        x: startX + c * spacingX,
        y: 70 + r * spacingY,
        w: 34,
        h: 24,
        hp: 12 + Math.floor((phase - 1) / 5) * 12,
        fireChance: 0.032 + phase * 0.0015,
        vx: Math.cos(moveAngle) * moveSpeed,
        vy: (Math.random() - 0.45) * moveSpeed,
        turnCd: 0.25 + Math.random() * 0.7,
      });
    }
  }
  state.phaseIntro = 1.0;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rectHit(a, b) {
  const aw = a.hitW || a.w;
  const ah = a.hitH || a.h;
  const bw = b.hitW || b.w;
  const bh = b.hitH || b.h;
  return Math.abs(a.x - b.x) * 2 < aw + bw && Math.abs(a.y - b.y) * 2 < ah + bh;
}

function shootNormal() {
  const p = state.player;
  if (p.shotCd > 0) return;
  p.shotCd = 0.11;
  state.playerBullets.push({ x: p.x, y: p.y - p.h / 2 - 10, w: 8, h: 16, vy: -770, dmg: 12, charge: false });
}

function shootCharge(chargeRatio = 0, xOffset = 0) {
  const p = state.player;
  const ratio = clamp(chargeRatio, 0, 1);
  const maxEnemyWidth = 34 * 2;
  const maxEnemyHeight = 24 * 2;
  state.playerBullets.push({
    x: p.x + xOffset,
    y: p.y - p.h / 2 - 12,
    w: Math.round(maxEnemyWidth * ratio),
    h: Math.round(maxEnemyHeight * ratio),
    vy: -900,
    dmg: Math.max(1, Math.round(60 * ratio)),
    charge: true,
    pierce: 2 + Math.floor(ratio * 4),
  });
  spawnBurst(p.x + xOffset, p.y - 20, "#6fd4ff", 14, 120);
}

function damagePlayer(dmg) {
  const p = state.player;
  if (p.invuln > 0 || state.gameOver) return;
  p.hp = clamp(p.hp - dmg, 0, p.maxHp);
  p.invuln = 0.35;
  state.screenShake = Math.max(state.screenShake, 0.22);
  spawnBurst(p.x, p.y - 8, "#ff8f63", 15, 180);

  if (p.hp <= 0) {
    spawnBurst(p.x, p.y, "#ffd36a", 28, 230);
    state.gameOver = true;
    state.running = false;
    message.textContent = "GAME OVER - Spaceで再開";
  }
}

function update(dt) {
  const p = state.player;
  p.shotCd = Math.max(0, p.shotCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  state.phaseIntro = Math.max(0, state.phaseIntro - dt);
  state.screenShake = Math.max(0, state.screenShake - dt);

  for (const s of state.stars) {
    s.y += s.v * dt;
    if (s.y > canvas.height + 2) {
      s.y = -2;
      s.x = Math.random() * canvas.width;
    }
  }

  for (const fx of state.particles) {
    fx.life -= dt;
    fx.x += fx.vx * dt;
    fx.y += fx.vy * dt;
    fx.vx *= 0.97;
    fx.vy = fx.vy * 0.97 + 16 * dt;
  }
  state.particles = state.particles.filter((fx) => fx.life > 0);

  const dir = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const targetVx = dir * p.speed;
  const accel = dir === 0 ? 0.1 : 0.18;
  p.vx += (targetVx - p.vx) * accel;
  p.x += p.vx * dt;
  p.x = clamp(p.x, p.w / 2, canvas.width - p.w / 2);
  p.y = canvas.height - 55;

  if (keys.Space) {
    p.charge = clamp(p.charge + dt, 0, p.maxCharge);
    if (p.charge < 0.2) shootNormal();
    p.chargeHeld = true;
  } else if (p.chargeHeld) {
    if (p.charge >= 0.35) {
      const chargeRatio = p.charge / p.maxCharge;
      shootCharge(chargeRatio);
      if (chargeRatio >= 1) {
        p.pendingChargeShots = 1;
        p.pendingChargeDelay = 0.09;
        p.pendingChargeRatio = chargeRatio;
      }
      p.shotCd = Math.max(p.shotCd, 0.16);
    }
    p.chargeHeld = false;
    p.charge = 0;
  }

  if (p.pendingChargeShots > 0) {
    p.pendingChargeDelay -= dt;
    if (p.pendingChargeDelay <= 0) {
      shootCharge(p.pendingChargeRatio, 10);
      p.pendingChargeShots -= 1;
      p.pendingChargeDelay = 0.09;
    }
  }

  for (const e of state.enemies) {
    e.turnCd -= dt;
    if (e.turnCd <= 0) {
      e.turnCd = 0.2 + Math.random() * 0.65;
      const moveSpeed = 38 + state.phase * 3 + Math.random() * 28;
      const moveAngle = Math.random() * Math.PI * 2;
      e.vx = Math.cos(moveAngle) * moveSpeed;
      e.vy = (Math.random() - 0.45) * moveSpeed;
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    const minY = e.h / 2 + 36;
    const maxY = p.y - p.h / 2 - e.h / 2 - 14;

    if (e.x <= e.w / 2 || e.x >= canvas.width - e.w / 2) {
      e.vx *= -1;
      e.x = clamp(e.x, e.w / 2, canvas.width - e.w / 2);
    }

    if (e.y <= minY || e.y >= maxY) {
      e.vy *= -1;
      e.y = clamp(e.y, minY, maxY);
    }

    if (Math.random() < e.fireChance * dt * 3.8) {
      state.enemyBullets.push({ x: e.x, y: e.y + e.h / 2, w: 8, h: 14, vy: getEnemyBulletSpeed(state.phase), dmg: 6 });
    }
  }

  for (const b of state.bosses) {
    if (b.hp <= 0) continue;
    b.x += b.vx * dt;
    if (b.x - b.w / 2 < 0 || b.x + b.w / 2 > canvas.width) {
      b.vx *= -1;
      b.x = clamp(b.x, b.w / 2, canvas.width - b.w / 2);
    }

    b.fireCd -= dt;
    b.volleyCd -= dt;
    b.burstCd -= dt;
    if (b.fireCd <= 0) {
      b.fireCd = Math.max(0.08, 0.4 - b.phase * 0.012);
      const lineDamage = b.phase === 15 ? 6 : 8;
      for (let i = -3; i <= 3; i++) {
        state.enemyBullets.push({
          x: b.x + i * 32,
          y: b.y + b.h / 2 - 8,
          w: 9,
          h: 16,
          vy: getEnemyBulletSpeed(b.phase) + 20,
          vx: i * 46,
          dmg: lineDamage,
        });
      }
    }
    if (b.volleyCd <= 0) {
      b.volleyCd = Math.max(0.6, 1.05 - b.phase * 0.02);
      const volleyCount = b.phase === 25 ? 28 : 20;
      const volleyDamage = b.phase === 15 ? 6 : 7;
      for (let i = 0; i < volleyCount; i++) {
        const ang = (Math.PI * 2 * i) / volleyCount;
        const spd = (b.phase === 25 ? 230 : 190) + b.phase * 5;
        state.enemyBullets.push({
          x: b.x,
          y: b.y + 16,
          w: 8,
          h: 8,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd + 140,
          dmg: volleyDamage,
        });
      }
    }

    if (b.phase === 25 && b.burstCd <= 0) {
      b.burstCd = 0.45;
      for (let i = 0; i < 14; i++) {
        const ang = (Math.PI * 2 * i) / 14 + performance.now() * 0.0016;
        const spd = 260;
        state.enemyBullets.push({
          x: b.x,
          y: b.y,
          w: 7,
          h: 7,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd + 120,
          dmg: 8,
        });
      }
    }
  }

  for (const b of state.playerBullets) b.y += b.vy * dt;
  for (const b of state.enemyBullets) {
    b.y += b.vy * dt;
    b.x += (b.vx || 0) * dt;
  }

  for (const pb of state.playerBullets) {
    for (const boss of state.bosses) {
      if (boss.hp > 0 && rectHit(pb, boss)) {
        boss.hp -= pb.dmg;
        spawnBurst(pb.x, pb.y, "#ffd36a", 6, 90);
        if (!pb.charge || pb.pierce <= 0) pb.hit = true;
        if (pb.charge) pb.pierce -= 1;
      }
    }

    for (const e of state.enemies) {
      if (e.hp > 0 && rectHit(pb, e)) {
        e.hp -= pb.dmg;
        if (e.hp <= 0) spawnBurst(e.x, e.y, "#ff6f91", 14, 170);
        else spawnBurst(pb.x, pb.y, "#ff9fbc", 5, 70);
        if (!pb.charge || pb.pierce <= 0) pb.hit = true;
        if (pb.charge) pb.pierce -= 1;
      }
    }
  }

  for (const eb of state.enemyBullets) {
    if (rectHit(eb, p)) {
      damagePlayer(eb.dmg);
      eb.hit = true;
    }
  }

  for (const boss of state.bosses) {
    if (boss.hp <= 0 && !boss.deadFx) {
      boss.deadFx = true;
      spawnBurst(boss.x, boss.y, "#ffce72", 48, 220, 1.2);
    }
  }

  state.enemies = state.enemies.filter((e) => e.hp > 0 && e.y - e.h / 2 <= canvas.height + 20);
  state.playerBullets = state.playerBullets.filter((b) => !b.hit && b.y + b.h >= 0);
  state.enemyBullets = state.enemyBullets.filter(
    (b) => !b.hit && b.y - b.h <= canvas.height + 30 && b.x > -40 && b.x < canvas.width + 40,
  );

  const hasBossWave = state.bosses.length > 0;
  const waveClear = !hasBossWave && state.enemies.length === 0;
  const bossClear = hasBossWave && state.bosses.every((b) => b.hp <= 0);

  if ((waveClear || bossClear) && !state.gameOver) {
    if (state.phase >= state.maxPhase) {
      state.victory = true;
      state.running = false;
      message.textContent = "ALL 25 PHASE CLEAR! Spaceで再挑戦";
      return;
    }

    state.phase += 1;
    if (state.phase === 25) state.player.hp = state.player.maxHp;
    else state.player.hp = clamp(state.player.hp + 14, 0, state.player.maxHp);
    spawnPhase(state.phase);
  }
}

function drawSprite(x, y, w, h, sprite, palette) {
  const rows = sprite.length;
  const cols = sprite[0].length;
  const px = w / cols;
  const py = h / rows;
  const x0 = x - w / 2;
  const y0 = y - h / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const code = sprite[r][c];
      if (code === ".") continue;
      const color = palette[code] || "#ffffff";
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x0 + c * px), Math.round(y0 + r * py), Math.ceil(px), Math.ceil(py));
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shakeX = state.screenShake > 0 ? (Math.random() - 0.5) * 8 * state.screenShake : 0;
  const shakeY = state.screenShake > 0 ? (Math.random() - 0.5) * 6 * state.screenShake : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  for (const s of state.stars) {
    ctx.fillStyle = "#9cc1ff";
    ctx.globalAlpha = 0.2 + s.s * 0.2;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  for (const e of state.enemies) {
    drawSprite(e.x, e.y, e.w, e.h, SPRITES.enemy, { "2": "#ff6f91" });
  }

  for (const b of state.bosses) {
    if (b.hp > 0) drawSprite(b.x, b.y, b.w, b.h, SPRITES.boss, { "3": "#ffce72", "4": "#8e2f2f" });
  }

  for (const b of state.playerBullets) {
    ctx.fillStyle = b.charge ? "#6fd4ff" : "#8df57a";
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  for (const b of state.enemyBullets) {
    ctx.fillStyle = "#ff8f63";
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }

  for (const fx of state.particles) {
    const alpha = clamp(fx.life / fx.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.x - fx.size / 2, fx.y - fx.size / 2, fx.size, fx.size);
  }
  ctx.globalAlpha = 1;

  if (!(state.player.invuln > 0 && Math.floor(performance.now() / 50) % 2 === 0)) {
    drawSprite(state.player.x, state.player.y, state.player.w, state.player.h, SPRITES.player, { "1": "#57c4ff", "4": "#d9f2ff" });
  }

  if (state.phaseIntro > 0) {
    ctx.fillStyle = "#ffffffd8";
    ctx.font = "bold 38px Segoe UI";
    ctx.textAlign = "center";
    const bossLabel = state.phase % 5 === 0 ? " BOSS" : "";
    ctx.fillText(`PHASE ${state.phase}${bossLabel}`, canvas.width / 2, canvas.height / 2);
  }

  if (state.paused) {
    ctx.fillStyle = "#02060dcc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d8e7ff";
    ctx.font = "bold 44px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = "20px Segoe UI";
    ctx.fillText("Pキーで再開", canvas.width / 2, canvas.height / 2 + 28);
  }

  ctx.restore();

  updateHud();
}

function updateHud() {
  const p = state.player;
  playerHpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
  playerHpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  chargeBar.style.width = `${(p.charge / p.maxCharge) * 100}%`;
  const phaseInfo = `PHASE ${state.phase} / ${state.maxPhase}${state.phase % 5 === 0 ? " (BOSS)" : ""}`;
  phaseText.textContent = phaseInfo;
  phaseBadge.textContent = `PHASE ${state.phase}/${state.maxPhase}`;

  if (state.bosses.length > 0) {
    bossRow.hidden = false;
    const totalHp = state.bosses.reduce((sum, b) => sum + Math.max(0, b.hp), 0);
    const totalMaxHp = state.bosses.reduce((sum, b) => sum + b.maxHp, 0);
    bossHpBar.style.width = `${(totalHp / totalMaxHp) * 100}%`;
    bossHpText.textContent = `${Math.max(0, Math.ceil(totalHp))} / ${totalMaxHp}`;
  } else {
    bossRow.hidden = true;
  }
}

function loop(ts) {
  if (!state.lastTime) state.lastTime = ts;
  const dt = Math.min(0.033, (ts - state.lastTime) / 1000);
  state.lastTime = ts;

  if (state.running && !state.paused) update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (e.code in keys) {
    keys[e.code] = true;
    e.preventDefault();
  }

  if (e.code === "KeyP" && state.running && !state.gameOver && !state.victory) {
    state.paused = !state.paused;
    message.textContent = state.paused ? "PAUSED (Pで再開)" : "";
  }

  if (e.code === "Space" && (!state.running || state.gameOver || state.victory)) {
    resetGame();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code in keys) {
    keys[e.code] = false;
    e.preventDefault();
  }
});

state.player = makePlayer();
updateHud();
requestAnimationFrame(loop);
