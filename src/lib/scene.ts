// Shared state between the globe and board islands on the home page.
// ES modules are singletons per page, so both islands see the same maps.

export interface WordPoint {
  /** viewport position of the word, in css px */
  x: number;
  y: number;
  /** globe scale, so a falling note can start at the word's size */
  scale: number;
}

/** written by the globe every frame, keyed by board item id */
export const wordPoints = new Map<string, WordPoint>();

/** written by the board, 0 = still on the globe, 1 = landed */
export const fallProgress = new Map<string, number>();
