// Deterministic Seeded 2D/3D Value & Gradient Noise for Infinite Voxel Terrain

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hash2D(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function hash3D(ix: number, iy: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1597334677) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class SeededNoise {
  public readonly seed: number;

  constructor(seedInput: string | number) {
    this.seed = typeof seedInput === 'number' ? seedInput >>> 0 : hashString(seedInput);
  }

  noise2D(x: number, z: number, salt = 0): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;

    const u = fade(fx);
    const v = fade(fz);

    const s = this.seed + salt * 1013904223;
    const n00 = hash2D(ix, iz, s) * 2 - 1;
    const n10 = hash2D(ix + 1, iz, s) * 2 - 1;
    const n01 = hash2D(ix, iz + 1, s) * 2 - 1;
    const n11 = hash2D(ix + 1, iz + 1, s) * 2 - 1;

    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }

  fbm2D(x: number, z: number, octaves = 4, persistence = 0.5, lacunarity = 2.0, salt = 0): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxVal = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, z * frequency, salt + i * 31) * amplitude;
      maxVal += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxVal;
  }

  noise3D(x: number, y: number, z: number, salt = 0): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;

    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);

    const s = this.seed + salt * 1664525;
    const n000 = hash3D(ix, iy, iz, s) * 2 - 1;
    const n100 = hash3D(ix + 1, iy, iz, s) * 2 - 1;
    const n010 = hash3D(ix, iy + 1, iz, s) * 2 - 1;
    const n110 = hash3D(ix + 1, iy + 1, iz, s) * 2 - 1;
    const n001 = hash3D(ix, iy, iz + 1, s) * 2 - 1;
    const n101 = hash3D(ix + 1, iy, iz + 1, s) * 2 - 1;
    const n011 = hash3D(ix, iy + 1, iz + 1, s) * 2 - 1;
    const n111 = hash3D(ix + 1, iy + 1, iz + 1, s) * 2 - 1;

    const nx00 = lerp(n000, n100, u);
    const nx10 = lerp(n010, n110, u);
    const nx01 = lerp(n001, n101, u);
    const nx11 = lerp(n011, n111, u);

    const nxy0 = lerp(nx00, nx10, v);
    const nxy1 = lerp(nx01, nx11, v);

    return lerp(nxy0, nxy1, w);
  }

  fbm3D(
    x: number,
    y: number,
    z: number,
    octaves = 3,
    persistence = 0.5,
    lacunarity = 2.0,
    salt = 0
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxVal = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency, salt + i * 47) * amplitude;
      maxVal += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxVal;
  }
}
