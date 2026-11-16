import React, { useEffect, useRef } from 'react';

interface FightSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

interface SlashArc {
  x: number;
  y: number;
  facing: 1 | -1;
  life: number;
  maxLife: number;
  color: string;
  radius?: number;
}

interface BlastWave {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxRadius: number;
}

interface ArrowProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
  life: number;
  maxLife: number;
}

type FighterRole = 'leader' | 'brute' | 'troop' | 'creeper' | 'swordsman' | 'archer';

interface ArmyFighter {
  id: number;
  team: 'zombie' | 'skeleton';
  role: FighterRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  walkPhase: number;
  hurtTimer: number;
  attackTimer: number;
  cooldown: number;
  bowPull: number;
  fuseTimer: number;
  onGround: boolean;
  hp: number;
  maxHp: number;
  koTimer: number;
  preferredRange: number;
  moveSpeed: number;
}

interface MenuDuelCanvasProps {
  variant?: 'card' | 'battlefield';
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  fillColor: string,
  isLeader: boolean
) {
  const barW = isLeader ? 32 : 22;
  const barH = isLeader ? 4 : 3;
  const bx = Math.round(x - barW / 2);
  const by = Math.round(y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  ctx.fillStyle = fillColor;
  ctx.fillRect(bx, by, Math.round(barW * ratio), barH);
}

function drawPixelCreeper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 1 | -1,
  walkPhase: number,
  fuseTimer: number,
  hurtFlash: boolean,
  koTimer: number,
  scale: number
) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-14 * scale, -2 * scale, 28 * scale, 5 * scale);

  if (koTimer > 0) {
    ctx.rotate(facing * -1.35 * Math.min(1, koTimer * 4));
  }

  // Swell + pulse right before exploding
  const fuseProgress = fuseTimer > 0 ? Math.min(1, fuseTimer / 0.68) : 0;
  const swell = fuseTimer > 0 ? 1 + fuseProgress * 0.24 + Math.sin(fuseTimer * 42) * 0.06 : 1;
  const whiteFlash = hurtFlash || (fuseTimer > 0 && Math.floor(fuseTimer * 18) % 2 === 0);

  ctx.scale(facing * scale * swell, scale * swell);

  const greenMain = whiteFlash ? '#f8fafc' : '#22c55e';
  const greenDark = whiteFlash ? '#cbd5e1' : '#15803d';
  const greenLight = whiteFlash ? '#ffffff' : '#4ade80';

  const legSwing = Math.sin(walkPhase) * 0.42;
  const bob = Math.abs(Math.sin(walkPhase)) * 1.4;

  // Back pair of stubby legs
  ctx.save();
  ctx.translate(-5, -13 - bob);
  ctx.rotate(-legSwing);
  ctx.fillStyle = greenDark;
  ctx.fillRect(-3.5, 0, 7, 13);
  ctx.fillStyle = '#0f3d1e';
  ctx.fillRect(-3.5, 10, 7, 3);
  ctx.restore();

  ctx.save();
  ctx.translate(5, -13 - bob);
  ctx.rotate(legSwing);
  ctx.fillStyle = greenDark;
  ctx.fillRect(-3.5, 0, 7, 13);
  ctx.fillStyle = '#0f3d1e';
  ctx.fillRect(-3.5, 10, 7, 3);
  ctx.restore();

  // Front pair of stubby legs
  ctx.save();
  ctx.translate(-3, -13 - bob);
  ctx.rotate(legSwing);
  ctx.fillStyle = greenMain;
  ctx.fillRect(-3.5, 0, 7, 13);
  ctx.fillStyle = '#14532d';
  ctx.fillRect(-3.5, 10, 7, 3);
  ctx.restore();

  ctx.save();
  ctx.translate(4, -13 - bob);
  ctx.rotate(-legSwing);
  ctx.fillStyle = greenMain;
  ctx.fillRect(-3.5, 0, 7, 13);
  ctx.fillStyle = '#14532d';
  ctx.fillRect(-3.5, 10, 7, 3);
  ctx.restore();

  // Creeper tall blocky body
  ctx.fillStyle = greenMain;
  ctx.fillRect(-6, -37 - bob, 12, 24);
  ctx.fillStyle = greenDark;
  ctx.fillRect(-6, -37 - bob, 4, 24);
  ctx.fillStyle = greenLight;
  ctx.fillRect(0, -33 - bob, 3, 4);
  ctx.fillRect(-2, -23 - bob, 4, 4);
  ctx.fillRect(2, -19 - bob, 3, 3);

  // Creeper Head + Iconic Face
  ctx.save();
  ctx.translate(0, -37 - bob);
  ctx.fillStyle = greenMain;
  ctx.fillRect(-9, -18, 18, 18);
  ctx.fillStyle = greenDark;
  ctx.fillRect(-9, -18, 4, 18);
  ctx.fillStyle = greenLight;
  ctx.fillRect(-4, -16, 4, 3);
  ctx.fillRect(3, -15, 4, 3);

  // Classic black eyes & frown facing forward
  const feature = whiteFlash ? '#334155' : '#090d0a';
  ctx.fillStyle = feature;
  ctx.fillRect(0, -13, 3, 4);
  ctx.fillRect(5, -13, 3, 4);
  ctx.fillRect(2, -9, 4, 3);
  ctx.fillRect(1, -6, 6, 4);
  ctx.fillRect(0, -4, 2, 3);
  ctx.fillRect(6, -4, 2, 3);
  ctx.restore();

  ctx.strokeStyle = fuseTimer > 0 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(134, 239, 172, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-9, -55 - bob, 18, 18);

  ctx.restore();
}

function drawPixelZombie(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 1 | -1,
  walkPhase: number,
  attackProgress: number,
  hurtFlash: boolean,
  koTimer: number,
  scale: number,
  role: FighterRole
) {
  const isLeader = role === 'leader';
  const isBrute = role === 'brute';

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-15 * scale, -2 * scale, 30 * scale, 5 * scale);

  if (koTimer > 0) {
    ctx.rotate(facing * -1.35 * Math.min(1, koTimer * 4));
  }

  ctx.scale(facing * scale, scale);

  const skin = hurtFlash ? '#ff5959' : isLeader ? '#4d8b35' : isBrute ? '#3f7d2d' : '#5e9643';
  const skinDark = hurtFlash ? '#cc2929' : '#365e24';
  const shirt = hurtFlash ? '#ff7373' : isLeader ? '#0e7490' : isBrute ? '#475569' : '#208285';
  const shirtDark = hurtFlash ? '#cc3b3b' : isBrute ? '#334155' : '#165b5e';
  const pants = hurtFlash ? '#ff6666' : '#303c8a';
  const pantsDark = hurtFlash ? '#b82828' : '#212961';

  const legSwing = Math.sin(walkPhase) * 0.48;
  const swingArc = attackProgress > 0 ? Math.sin(attackProgress * Math.PI) : 0;
  const punchAngle = -swingArc * 1.45;
  const bob = Math.abs(Math.sin(walkPhase)) * 1.8;

  // Back leg
  ctx.save();
  ctx.translate(0, -18 - bob);
  ctx.rotate(-legSwing);
  ctx.fillStyle = pantsDark;
  ctx.fillRect(-4, 0, 8, 18);
  ctx.fillStyle = '#2b2421';
  ctx.fillRect(-4, 15, 8, 3);
  ctx.restore();

  // Front leg
  ctx.save();
  ctx.translate(0, -18 - bob);
  ctx.rotate(legSwing);
  ctx.fillStyle = pants;
  ctx.fillRect(-4, 0, 8, 18);
  ctx.fillStyle = '#3b312d';
  ctx.fillRect(-4, 15, 8, 3);
  ctx.restore();

  // Back arm (or brute iron shield)
  ctx.save();
  ctx.translate(1, -36 - bob);
  ctx.rotate(-0.22 + punchAngle * 0.6);
  ctx.fillStyle = shirtDark;
  ctx.fillRect(-2, -3, 7, 6);
  ctx.fillStyle = skinDark;
  ctx.fillRect(5, -3, 12, 6);
  if (isBrute) {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(14, -9, 4, 18);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(15, -7, 2, 14);
  }
  ctx.restore();

  // Torso
  ctx.fillStyle = shirt;
  ctx.fillRect(-6, -39 - bob, 12, 21);
  ctx.fillStyle = shirtDark;
  ctx.fillRect(-6, -39 - bob, 4, 21);
  if (isBrute) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-7, -38 - bob, 14, 5);
  }

  // Head
  ctx.save();
  ctx.translate(0, -40 - bob);
  ctx.fillStyle = skin;
  ctx.fillRect(-9, -18, 18, 18);
  ctx.fillStyle = skinDark;
  ctx.fillRect(-9, -18, 5, 18);
  ctx.fillStyle = hurtFlash ? '#ffffff' : '#141e10';
  ctx.fillRect(2, -12, 5, 4);
  ctx.fillStyle = hurtFlash ? '#ffe5e5' : isBrute ? '#facc15' : '#ff6b35';
  ctx.fillRect(5, -11, 2, 2);
  ctx.fillStyle = skinDark;
  ctx.fillRect(3, -5, 6, 3);

  if (isLeader) {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-10, -21, 20, 5);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-8, -24, 4, 3);
    ctx.fillRect(-2, -25, 4, 4);
    ctx.fillRect(4, -24, 4, 3);
  } else if (isBrute) {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-10, -20, 20, 6);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-4, -22, 8, 3);
  }
  ctx.restore();

  // Front arm + Sword
  ctx.save();
  ctx.translate(2, -35 - bob);
  ctx.rotate(0.15 + punchAngle);
  ctx.fillStyle = shirt;
  ctx.fillRect(-2, -3, 7, 6);
  ctx.fillStyle = skin;
  ctx.fillRect(5, -3, 12, 6);

  ctx.save();
  ctx.translate(16, 0);
  ctx.rotate(-0.65 + swingArc * 1.45);
  ctx.fillStyle = '#5c3a21';
  ctx.fillRect(-2, -2, 4, 7);
  ctx.fillStyle = isLeader ? '#f59e0b' : '#94a3b8';
  ctx.fillRect(-5, -4, 10, 3);
  ctx.fillStyle = isLeader ? '#38bdf8' : isBrute ? '#cbd5e1' : '#e2e8f0';
  ctx.fillRect(-2, isBrute ? -25 : -22, isBrute ? 5 : 4, isBrute ? 21 : 18);
  ctx.fillStyle = isLeader ? '#bae6fd' : '#ffffff';
  ctx.fillRect(0, isBrute ? -26 : -24, 2, isBrute ? 22 : 20);
  ctx.restore();
  ctx.restore();

  ctx.strokeStyle = isLeader ? 'rgba(250, 204, 21, 0.8)' : 'rgba(74, 222, 128, 0.38)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-9, -58 - bob, 18, 18);

  ctx.restore();
}

function drawPixelSkeleton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 1 | -1,
  walkPhase: number,
  bowPull: number,
  meleeProgress: number,
  hurtFlash: boolean,
  koTimer: number,
  scale: number,
  role: FighterRole
) {
  const isLeader = role === 'leader';
  const isSwordsman = role === 'swordsman';

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-14 * scale, -2 * scale, 28 * scale, 5 * scale);

  if (koTimer > 0) {
    ctx.rotate(facing * -1.35 * Math.min(1, koTimer * 4));
  }

  ctx.scale(facing * scale, scale);

  const bone = hurtFlash ? '#ff5959' : isLeader ? '#f5f0e6' : '#ede8dc';
  const boneDark = hurtFlash ? '#c92a2a' : '#bdb6a7';
  const ribDark = hurtFlash ? '#8f1d1d' : '#3d3734';
  const bob = Math.abs(Math.sin(walkPhase)) * 1.6;
  const legSwing = Math.sin(walkPhase) * 0.48;

  // Back leg
  ctx.save();
  ctx.translate(-1, -18 - bob);
  ctx.rotate(-legSwing);
  ctx.fillStyle = boneDark;
  ctx.fillRect(-2.5, 0, 5, 18);
  ctx.restore();

  // Front leg
  ctx.save();
  ctx.translate(1, -18 - bob);
  ctx.rotate(legSwing);
  ctx.fillStyle = bone;
  ctx.fillRect(-2.5, 0, 5, 18);
  ctx.restore();

  // Ribcage torso
  ctx.fillStyle = bone;
  ctx.fillRect(-5, -39 - bob, 10, 21);
  ctx.fillStyle = ribDark;
  for (let r = 0; r < 4; r++) {
    ctx.fillRect(-3, -36 + r * 4 - bob, 8, 2);
  }
  ctx.fillStyle = boneDark;
  ctx.fillRect(-5, -39 - bob, 3, 21);

  if (isSwordsman) {
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-7, -39 - bob, 14, 5);
  }

  // Skull
  ctx.save();
  ctx.translate(0, -40 - bob);
  ctx.fillStyle = bone;
  ctx.fillRect(-9, -18, 18, 18);
  ctx.fillStyle = boneDark;
  ctx.fillRect(-9, -18, 4, 18);
  ctx.fillStyle = hurtFlash ? '#ffffff' : '#181414';
  ctx.fillRect(2, -12, 5, 4);
  ctx.fillStyle = hurtFlash ? '#ffd6d6' : isLeader ? '#ef4444' : isSwordsman ? '#fb7185' : '#fbbf24';
  ctx.fillRect(5, -11, 2, 2);
  ctx.fillStyle = '#292422';
  ctx.fillRect(1, -5, 8, 2);

  if (isLeader) {
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-10, -21, 20, 4);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-7, -25, 4, 4);
    ctx.fillRect(3, -25, 4, 4);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-1, -26, 3, 5);
  } else if (isSwordsman) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(-10, -20, 20, 5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-3, -23, 6, 3);
  }
  ctx.restore();

  // Weapon arm
  const swingArc = meleeProgress > 0 ? Math.sin(meleeProgress * Math.PI) * 1.35 : 0;
  ctx.save();
  ctx.translate(2, -35 - bob);
  ctx.rotate(isSwordsman ? -swingArc : swingArc - bowPull * 0.14);

  ctx.fillStyle = bone;
  ctx.fillRect(0, -2, 13, 4);

  if (isSwordsman) {
    ctx.save();
    ctx.translate(14, 0);
    ctx.rotate(-0.6 + swingArc * 1.35);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(-4, -3, 8, 3);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-2, -21, 4, 18);
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(0, -23, 2, 20);
    ctx.restore();
  } else {
    const bowX = 12;
    ctx.fillStyle = isLeader ? '#9a3412' : '#6f4324';
    ctx.fillRect(bowX, -11, 3, 22);
    ctx.fillStyle = isLeader ? '#ea580c' : '#8d5932';
    ctx.fillRect(bowX - 2, -13, 3, 4);
    ctx.fillRect(bowX - 2, 9, 3, 4);

    const pullOffset = bowPull * 8;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bowX - 1, -11);
    ctx.lineTo(bowX - 2 - pullOffset, 0);
    ctx.lineTo(bowX - 1, 11);
    ctx.stroke();

    if (bowPull > 0.12) {
      ctx.fillStyle = '#9a6b42';
      ctx.fillRect(bowX - 2 - pullOffset, -1, 16, 2);
      ctx.fillStyle = isLeader ? '#fb7185' : '#fde047';
      ctx.fillRect(bowX + 12 - pullOffset, -2.5, 5, 5);
    }
  }
  ctx.restore();

  ctx.strokeStyle = isLeader ? 'rgba(249, 115, 22, 0.8)' : 'rgba(251, 191, 36, 0.38)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-9, -58 - bob, 18, 18);

  ctx.restore();
}

function drawPixelArrow(ctx: CanvasRenderingContext2D, arrow: ArrowProjectile) {
  const angle = Math.atan2(arrow.vy, arrow.vx);
  ctx.save();
  ctx.translate(arrow.x, arrow.y);
  ctx.rotate(angle);
  ctx.fillStyle = '#a47148';
  ctx.fillRect(-10, -1.5, 18, 3);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(6, -2.5, 5, 5);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-12, -3, 4, 6);
  ctx.restore();
}

export const MenuDuelCanvas: React.FC<MenuDuelCanvasProps> = ({ variant = 'card', cardRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isBattlefield = variant === 'battlefield';
    let rafId = 0;
    let width = isBattlefield ? window.innerWidth : 640;
    let height = isBattlefield ? window.innerHeight : 104;

    const resize = () => {
      if (isBattlefield) {
        width = window.innerWidth;
        height = window.innerHeight;
      } else {
        const parent = canvas.parentElement;
        width = parent ? parent.clientWidth : 640;
        height = parent ? parent.clientHeight : 104;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const getFloorY = () => (isBattlefield ? Math.max(180, height - 18) : height - 4);
    const floorY = getFloorY();
    const fighters: ArmyFighter[] = [];
    const teamSize = isBattlefield ? 10 : 5;

    // Zombie & Creeper Horde (left flank)
    for (let i = 0; i < teamSize; i++) {
      const role: FighterRole =
        i === 0
          ? 'leader'
          : isBattlefield
            ? i === 2 || i === 5 || i === 8
              ? 'creeper'
              : i % 3 === 1
                ? 'brute'
                : 'troop'
            : i === 2
              ? 'creeper'
              : i === 1
                ? 'brute'
                : 'troop';
      const maxHp = role === 'leader' ? 32 : role === 'brute' ? 22 : role === 'creeper' ? 14 : 14;
      fighters.push({
        id: i,
        team: 'zombie',
        role,
        x: Math.max(24, width * (0.04 + i * (isBattlefield ? 0.038 : 0.065))),
        y: floorY,
        vx: 85 + i * 7,
        vy: 0,
        facing: 1,
        walkPhase: i * 0.85,
        hurtTimer: 0,
        attackTimer: 0,
        cooldown: 0.12 + i * 0.1,
        bowPull: 0,
        fuseTimer: 0,
        onGround: true,
        hp: maxHp,
        maxHp,
        koTimer: 0,
        preferredRange: role === 'creeper' ? 28 : role === 'brute' ? 34 : 28 + (i % 3) * 8,
        moveSpeed: isBattlefield
          ? role === 'leader'
            ? 145
            : role === 'creeper'
              ? 162
              : role === 'brute'
                ? 122
                : 150 + (i % 3) * 14
          : role === 'leader'
            ? 115
            : role === 'creeper'
              ? 138
              : 126 + (i % 3) * 12,
      });
    }

    // Skeleton Legion (right flank)
    for (let i = 0; i < teamSize; i++) {
      const role: FighterRole = i === 0 ? 'leader' : i % 2 === 1 ? 'swordsman' : 'archer';
      const maxHp = role === 'leader' ? 30 : role === 'swordsman' ? 18 : 13;
      fighters.push({
        id: teamSize + i,
        team: 'skeleton',
        role,
        x: Math.min(width - 24, width * (0.96 - i * (isBattlefield ? 0.038 : 0.065))),
        y: floorY,
        vx: -(75 + i * 6),
        vy: 0,
        facing: -1,
        walkPhase: i * 1.05,
        hurtTimer: 0,
        attackTimer: 0,
        cooldown: 0.18 + i * 0.13,
        bowPull: role === 'archer' || role === 'leader' ? 0.3 : 0,
        fuseTimer: 0,
        onGround: true,
        hp: maxHp,
        maxHp,
        koTimer: 0,
        preferredRange:
          role === 'swordsman' ? 30 + (i % 2) * 8 : isBattlefield ? 165 + i * 24 : 105 + i * 20,
        moveSpeed: isBattlefield
          ? role === 'leader'
            ? 130
            : role === 'swordsman'
              ? 146
              : 128 + (i % 2) * 12
          : role === 'leader'
            ? 105
            : 115 + (i % 2) * 12,
      });
    }

    const sparks: FightSpark[] = [];
    const slashes: SlashArc[] = [];
    const blastWaves: BlastWave[] = [];
    const arrows: ArrowProjectile[] = [];
    let lastTime = performance.now();

    const spawnSparks = (x: number, y: number, count: number, colorA: string, colorB: string) => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 85 + Math.random() * 215;
        sparks.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 75,
          size: (isBattlefield ? 3.4 : 2.6) + Math.random() * 3.6,
          life: 0,
          maxLife: 0.25 + Math.random() * 0.32,
          color: i % 2 === 0 ? colorA : colorB,
        });
      }
    };

    const applyHit = (
      attacker: ArmyFighter | null,
      defender: ArmyFighter,
      dmg: number,
      knockX: number,
      knockY: number,
      sparkA: string,
      sparkB: string
    ) => {
      defender.hurtTimer = 0.2;
      defender.vx = knockX;
      if (defender.onGround) {
        defender.vy = knockY;
        defender.onGround = false;
      }
      defender.hp = Math.max(0, defender.hp - dmg);
      const midX = attacker ? (attacker.x + defender.x) * 0.5 : defender.x;
      spawnSparks(midX, defender.y - 32, 10, sparkA, sparkB);

      if (defender.hp <= 0) {
        defender.koTimer = 0.58;
        defender.fuseTimer = 0;
        defender.vy = -245;
        defender.onGround = false;
        spawnSparks(defender.x, defender.y - 30, 18, '#fbbf24', '#ffffff');
      }
    };

    const detonateCreeper = (creeper: ArmyFighter, groundY: number) => {
      const blastX = creeper.x;
      const blastY = Math.min(creeper.y, groundY) - 26;
      const blastRadius = isBattlefield ? 98 : 76;

      blastWaves.push({
        x: blastX,
        y: blastY,
        life: 0,
        maxLife: 0.34,
        maxRadius: blastRadius,
      });

      spawnSparks(blastX, blastY, 22, '#fef08a', '#f97316');
      spawnSparks(blastX, blastY, 14, '#4ade80', '#e2e8f0');

      for (const other of fighters) {
        if (other.id === creeper.id || other.koTimer > 0) continue;
        if (other.team === 'zombie' && other.role !== 'creeper') continue; // spare allied zombies from friendly splash
        const dx = other.x - blastX;
        const dist = Math.abs(dx);
        if (dist <= blastRadius) {
          const dir = dx >= 0 ? 1 : -1;
          const falloff = 1 - dist / blastRadius;
          const dmg = Math.max(3, Math.round((other.team === 'skeleton' ? 11 : 6) * (0.45 + falloff * 0.65)));
          applyHit(creeper, other, dmg, dir * (240 + falloff * 180), -250 - falloff * 90, '#fde047', '#ef4444');
        }
      }

      creeper.hp = 0;
      creeper.fuseTimer = 0;
      creeper.koTimer = 0.72;
      creeper.vy = -220;
      creeper.onGround = false;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const minX = 24;
      const maxX = Math.max(160, width - 24);
      const groundY = getFloorY();
      void cardRef;

      for (const f of fighters) {
        f.hurtTimer = Math.max(0, f.hurtTimer - dt);
        f.attackTimer = Math.max(0, f.attackTimer - dt);
        f.cooldown = Math.max(0, f.cooldown - dt);

        if (f.koTimer > 0) {
          f.koTimer = Math.max(0, f.koTimer - dt);
          if (f.koTimer === 0) {
            f.hp = f.maxHp;
            f.fuseTimer = 0;
            f.x = f.team === 'zombie' ? minX + Math.random() * 64 : maxX - Math.random() * 64;
            f.vy = -225;
            f.onGround = false;
            spawnSparks(f.x, f.y - 28, 12, f.role === 'creeper' ? '#4ade80' : '#fb923c', '#fef08a');
          }
        }

        if (!f.onGround || f.y < groundY - 0.5) {
          f.vy += 960 * dt;
          f.y += f.vy * dt;
          if (f.y >= groundY) {
            f.y = groundY;
            f.vy = 0;
            f.onGround = true;
          }
        } else {
          f.y = groundY;
        }
      }

      for (const f of fighters) {
        if (f.koTimer > 0) {
          f.vx *= Math.pow(0.25, dt);
          f.x += f.vx * dt;
          continue;
        }

        let target: ArmyFighter | null = null;
        let minDist = Infinity;
        for (const other of fighters) {
          if (other.team === f.team || other.koTimer > 0) continue;
          const d = Math.abs(other.x - f.x);
          if (d < minDist) {
            minDist = d;
            target = other;
          }
        }

        if (!target) {
          f.vx *= Math.pow(0.4, dt);
          f.x += f.vx * dt;
          continue;
        }

        const dx = target.x - f.x;
        const dist = Math.abs(dx);
        const dirToEnemy: 1 | -1 = dx >= 0 ? 1 : -1;
        f.facing = dirToEnemy;

        if (f.role === 'creeper') {
          // Creeper rushes enemy skeletons and swells to explode!
          if (f.fuseTimer > 0) {
            f.fuseTimer += dt;
            f.vx *= Math.pow(0.08, dt);
            f.x += f.vx * dt;
            if (dist > 78 && f.fuseTimer < 0.42) {
              // Enemy dashed out of blast range early; cool fuse down and resume chase
              f.fuseTimer = Math.max(0, f.fuseTimer - dt * 2.2);
            } else if (f.fuseTimer >= 0.68) {
              detonateCreeper(f, groundY);
            }
          } else {
            const desiredVx = dist > 30 ? dirToEnemy * f.moveSpeed : 0;
            f.vx += (desiredVx - f.vx) * Math.min(1, dt * 8);
            f.x += f.vx * dt;
            if (f.onGround && dist > 55 && dist < 170 && Math.random() < dt * 0.9) {
              f.vy = -230;
              f.onGround = false;
            }
            if (dist < 46) {
              f.fuseTimer = 0.02;
              if (f.onGround) {
                f.vy = -120;
                f.onGround = false;
              }
            }
          }
          continue;
        }

        const isRangedSkeleton = f.team === 'skeleton' && (f.role === 'archer' || f.role === 'leader');

        if (!isRangedSkeleton) {
          const desiredVx = dist > f.preferredRange ? dirToEnemy * f.moveSpeed : 0;
          f.vx += (desiredVx - f.vx) * Math.min(1, dt * 7);
          f.x += f.vx * dt;

          if (f.onGround && dist > 65 && dist < 210 && Math.random() < dt * 1.15) {
            f.vy = -265;
            f.onGround = false;
          }

          if (dist < 48 && f.cooldown <= 0) {
            f.attackTimer = 0.25;
            f.cooldown = f.role === 'leader' ? 0.54 : f.role === 'brute' ? 0.78 : 0.68;
            const dmg = f.role === 'leader' ? 5 : f.role === 'brute' ? 4 : 3;
            slashes.push({
              x: f.x + dirToEnemy * 22,
              y: f.y - 28,
              facing: dirToEnemy,
              life: 0,
              maxLife: 0.16,
              color:
                f.team === 'zombie'
                  ? f.role === 'leader'
                    ? '#38bdf8'
                    : '#e2e8f0'
                  : '#fb923c',
              radius: f.role === 'leader' || f.role === 'brute' ? 20 : 16,
            });
            applyHit(
              f,
              target,
              dmg,
              dirToEnemy * 190,
              -145,
              f.team === 'zombie' ? '#fef08a' : '#ffffff',
              f.team === 'zombie' ? '#ef4444' : '#fb923c'
            );
          }
        } else {
          const ideal = Math.min(f.preferredRange, (maxX - minX) * 0.42);
          let desiredVx = 0;
          if (dist < ideal - 20) {
            desiredVx = -dirToEnemy * f.moveSpeed;
          } else if (dist > ideal + 32) {
            desiredVx = dirToEnemy * (f.moveSpeed * 0.92);
          }

          if (f.onGround && dist < 54 && (f.x < minX + 54 || f.x > maxX - 54)) {
            f.vy = -315;
            f.onGround = false;
            f.vx = dirToEnemy * 225;
          } else {
            f.vx += (desiredVx - f.vx) * Math.min(1, dt * 6.5);
          }
          f.x += f.vx * dt;

          if (dist < 44 && f.cooldown <= 0) {
            f.bowPull = 0;
            f.attackTimer = 0.24;
            f.cooldown = 0.68;
            slashes.push({
              x: f.x + dirToEnemy * 18,
              y: f.y - 26,
              facing: dirToEnemy,
              life: 0,
              maxLife: 0.16,
              color: '#fbbf24',
            });
            applyHit(f, target, f.role === 'leader' ? 4 : 3, dirToEnemy * 165, -135, '#ffffff', '#fb923c');
          } else if (dist >= 44 && f.cooldown <= 0.42) {
            f.bowPull = Math.min(1, f.bowPull + dt * 2.9);
            if (f.bowPull >= 1 && f.cooldown <= 0) {
              f.bowPull = 0;
              f.cooldown = f.role === 'leader' ? 0.64 : 0.9;
              arrows.push({
                x: f.x + dirToEnemy * 14,
                y: f.y - 28,
                vx: dirToEnemy * (f.role === 'leader' ? 480 : 415),
                vy: (target.y - f.y) * 0.35 - 18 - Math.random() * 18,
                stuck: false,
                life: 0,
                maxLife: 1.4,
              });
              spawnSparks(f.x + dirToEnemy * 16, f.y - 28, 4, '#fde047', '#fb923c');
            }
          } else {
            f.bowPull = Math.max(0, f.bowPull - dt * 4);
          }
        }
      }

      // Same-team soft separation
      const minSep = isBattlefield ? 22 : 16;
      for (let i = 0; i < fighters.length; i++) {
        const a = fighters[i];
        if (a.koTimer > 0) continue;
        for (let j = i + 1; j < fighters.length; j++) {
          const b = fighters[j];
          if (b.koTimer > 0 || a.team !== b.team) continue;
          const sep = b.x - a.x;
          if (Math.abs(sep) < minSep) {
            const push = (minSep - Math.abs(sep)) * 0.35;
            const sgn = sep >= 0 ? 1 : -1;
            a.x -= sgn * push;
            b.x += sgn * push;
          }
        }
      }

      for (const f of fighters) {
        if (f.x < minX) {
          f.x = minX;
          f.vx = Math.max(0, f.vx);
        } else if (f.x > maxX) {
          f.x = maxX;
          f.vx = Math.min(0, f.vx);
        }
        f.walkPhase += Math.abs(f.vx) * dt * 0.09 + dt * 1.5;
      }

      // Arrows hit enemy zombies & creepers
      for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i];
        a.life += dt;
        if (a.life >= a.maxLife) {
          arrows.splice(i, 1);
          continue;
        }
        if (!a.stuck) {
          a.vy += 150 * dt;
          a.x += a.vx * dt;
          a.y += a.vy * dt;

          let hitHorde = false;
          for (const z of fighters) {
            if (z.team !== 'zombie' || z.koTimer > 0) continue;
            if (Math.abs(a.x - z.x) < 16 && a.y >= z.y - 58 && a.y <= z.y - 2) {
              applyHit(null, z, 3, Math.sign(a.vx) * 135, -110, '#fde047', '#ef4444');
              hitHorde = true;
              break;
            }
          }
          if (hitHorde) {
            arrows.splice(i, 1);
            continue;
          }
          if (a.y >= groundY - 2 || a.x < 0 || a.x > width) {
            a.y = Math.min(a.y, groundY - 2);
            a.stuck = true;
            a.life = Math.max(a.life, a.maxLife - 0.3);
          }
        }
      }

      for (let i = slashes.length - 1; i >= 0; i--) {
        slashes[i].life += dt;
        if (slashes[i].life >= slashes[i].maxLife) {
          slashes.splice(i, 1);
        }
      }
      for (let i = blastWaves.length - 1; i >= 0; i--) {
        blastWaves[i].life += dt;
        if (blastWaves[i].life >= blastWaves[i].maxLife) {
          blastWaves.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life >= s.maxLife) {
          sparks.splice(i, 1);
          continue;
        }
        s.vy += 450 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }

      ctx.clearRect(0, 0, width, height);

      if (isBattlefield) {
        const ledgeGrad = ctx.createLinearGradient(0, groundY - 14, 0, height);
        ledgeGrad.addColorStop(0, 'rgba(18, 8, 7, 0)');
        ledgeGrad.addColorStop(0.55, 'rgba(18, 8, 7, 0.65)');
        ledgeGrad.addColorStop(1, 'rgba(12, 4, 4, 0.88)');
        ctx.fillStyle = ledgeGrad;
        ctx.fillRect(0, groundY - 14, width, height - (groundY - 14));

        ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
        ctx.fillRect(0, groundY, width, 2);
      }

      const baseScale = isBattlefield
        ? width < 520
          ? 0.88
          : 1.08
        : width < 420
          ? 0.72
          : 0.86;

      const ordered = [...fighters].sort(
        (a, b) => (a.role === 'leader' ? 1 : 0) - (b.role === 'leader' ? 1 : 0)
      );
      for (const f of ordered) {
        const isLeader = f.role === 'leader';
        const roleScale = isLeader ? 1.18 : f.role === 'brute' ? 1.02 : 0.9;
        const sc = baseScale * roleScale;
        if (f.role === 'creeper') {
          drawPixelCreeper(
            ctx,
            f.x,
            f.y,
            f.facing,
            f.walkPhase,
            f.fuseTimer,
            f.hurtTimer > 0,
            f.koTimer,
            sc
          );
          drawHealthBar(
            ctx,
            f.x,
            f.y - 68 * sc,
            f.hp,
            f.maxHp,
            f.fuseTimer > 0 ? '#fef08a' : '#86efac',
            false
          );
        } else if (f.team === 'zombie') {
          drawPixelZombie(
            ctx,
            f.x,
            f.y,
            f.facing,
            f.walkPhase,
            f.attackTimer > 0 ? 1 - f.attackTimer / 0.25 : 0,
            f.hurtTimer > 0,
            f.koTimer,
            sc,
            f.role
          );
          drawHealthBar(ctx, f.x, f.y - 70 * sc, f.hp, f.maxHp, isLeader ? '#4ade80' : '#22c55e', isLeader);
        } else {
          drawPixelSkeleton(
            ctx,
            f.x,
            f.y,
            f.facing,
            f.walkPhase,
            f.bowPull,
            f.attackTimer > 0 ? 1 - f.attackTimer / 0.24 : 0,
            f.hurtTimer > 0,
            f.koTimer,
            sc,
            f.role
          );
          drawHealthBar(ctx, f.x, f.y - 70 * sc, f.hp, f.maxHp, isLeader ? '#fb923c' : '#f59e0b', isLeader);
        }
      }

      for (const bw of blastWaves) {
        const p = bw.life / bw.maxLife;
        const r = bw.maxRadius * (0.25 + p * 0.85);
        ctx.save();
        ctx.globalAlpha = Math.max(0, (1 - p) * 0.85);
        ctx.fillStyle = p < 0.35 ? 'rgba(254, 240, 138, 0.5)' : 'rgba(249, 115, 22, 0.22)';
        ctx.beginPath();
        ctx.arc(bw.x, bw.y, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p < 0.4 ? '#ffffff' : '#fb923c';
        ctx.lineWidth = Math.max(1.5, 5 * (1 - p));
        ctx.beginPath();
        ctx.arc(bw.x, bw.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (const sl of slashes) {
        const p = sl.life / sl.maxLife;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = sl.color;
        ctx.lineWidth = (isBattlefield ? 4 : 3.5) * (1 - p * 0.5);
        ctx.beginPath();
        const r = (sl.radius ?? 16) + p * 7;
        if (sl.facing === 1) {
          ctx.arc(sl.x - 8, sl.y, r, -Math.PI * 0.42, Math.PI * 0.42);
        } else {
          ctx.arc(sl.x + 8, sl.y, r, Math.PI * 0.58, Math.PI * 1.42);
        }
        ctx.stroke();
        ctx.restore();
      }

      for (const a of arrows) {
        drawPixelArrow(ctx, a);
      }

      for (const s of sparks) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - s.life / s.maxLife);
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [variant, cardRef]);

  if (variant === 'battlefield') {
    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[5] h-full w-full"
        aria-hidden="true"
      />
    );
  }

  return <canvas ref={canvasRef} className="pointer-events-none block h-full w-full" aria-hidden="true" />;
};
