export interface Spring {
  value: number;
  velocity: number;
}

export interface SpringConfig {
  stiffness: number;
  damping: number;
  /** distance and speed below which the spring counts as at rest */
  rest: number;
}

export function spring(value: number): Spring {
  return { value, velocity: 0 };
}

/** One semi-implicit Euler step. Returns true when the spring is at rest. */
export function stepSpring(s: Spring, target: number, dt: number, config: SpringConfig): boolean {
  const force = config.stiffness * (target - s.value) - config.damping * s.velocity;
  s.velocity += force * dt;
  s.value += s.velocity * dt;
  const atRest = Math.abs(target - s.value) < config.rest && Math.abs(s.velocity) < config.rest;
  if (atRest) {
    s.value = target;
    s.velocity = 0;
  }
  return atRest;
}

export function snapSpring(s: Spring, value: number): void {
  s.value = value;
  s.velocity = 0;
}
