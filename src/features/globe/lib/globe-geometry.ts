export interface Vec {
  x: number;
  y: number;
  z: number;
}

export interface WordPoint extends Vec {
  word: string;
  /** board item id, set on words that fall off the globe */
  id?: string;
}

export interface GlobeWord {
  word: string;
  id?: string;
}

/** Fibonacci sphere. Loose words are spaced evenly so they never bunch up. */
export function buildWordPoints(loose: GlobeWord[], plain: string[]): WordPoint[] {
  const total = loose.length + plain.length;
  const slots: GlobeWord[] = new Array(total);
  loose.forEach((word, k) => {
    slots[Math.floor(((k + 0.5) * total) / loose.length)] = word;
  });
  let next = 0;
  for (let i = 0; i < total; i++) {
    if (slots[i]) continue;
    slots[i] = { word: plain[next++] };
  }

  const phi = Math.PI * (Math.sqrt(5) - 1);
  return slots.map((slot, i) => {
    const y = 1 - (i / (total - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    return { x: Math.cos(phi * i) * r, y, z: Math.sin(phi * i) * r, ...slot };
  });
}

/** Latitude and longitude rings for the wireframe. */
export function buildRings(): Vec[][] {
  const rings: Vec[][] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const ring: Vec[] = [];
    const y = Math.sin((lat * Math.PI) / 180);
    const r = Math.cos((lat * Math.PI) / 180);
    for (let a = 0; a <= 360; a += 4) {
      const rad = (a * Math.PI) / 180;
      ring.push({ x: Math.cos(rad) * r, y, z: Math.sin(rad) * r });
    }
    rings.push(ring);
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const ring: Vec[] = [];
    const rad = (lon * Math.PI) / 180;
    for (let a = -90; a <= 90; a += 4) {
      const arad = (a * Math.PI) / 180;
      ring.push({
        x: Math.cos(arad) * Math.cos(rad),
        y: Math.sin(arad),
        z: Math.cos(arad) * Math.sin(rad),
      });
    }
    rings.push(ring);
  }
  return rings;
}

/** Spin around y, then tilt around x. */
export function rotatePoint(p: Vec, yaw: number, sinTilt: number, cosTilt: number): Vec {
  const sa = Math.sin(yaw);
  const ca = Math.cos(yaw);
  const x = p.x * ca + p.z * sa;
  const z1 = -p.x * sa + p.z * ca;
  return { x, y: p.y * cosTilt - z1 * sinTilt, z: p.y * sinTilt + z1 * cosTilt };
}
