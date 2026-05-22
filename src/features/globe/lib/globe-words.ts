// Single-word labels distributed across the globe. Plain array so it can be
// edited without touching the canvas code. Three buckets: tech verbs, RPG
// nouns, and mood / identity words.
export const GLOBE_WORDS: string[] = [
  // tech verbs
  'build', 'break', 'debug', 'ship', 'refactor', 'fork', 'patch', 'commit',
  'merge', 'rebase', 'parse', 'compile', 'crash', 'panic', 'segfault', 'leak',
  'overflow', 'fuzz', 'trace', 'inspect', 'hack',
  // RPG nouns
  'crit', 'spawn', 'respawn', 'grind', 'loot', 'quest', 'dungeon', 'boss',
  'mana', 'parry', 'dodge', 'cast', 'enchant', 'forge', 'craft', 'tinker',
  'sigil', 'rune', 'guild', 'lore',
  // mood / identity
  'curious', 'restless', 'stubborn', 'precise', 'careful', 'midnight',
  'monorepo', 'config', 'undo', 'rollback', 'snapshot', 'diff', 'replay',
  'iterate', 'prototype', 'sketch', 'finish', 'wander', 'explore', 'beacon',
  'signal', 'cipher', 'seed',
];
