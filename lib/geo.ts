/**
 * Coordinate mapping between our stylized 0–100 viewBox coordinates
 * and real-world latitude/longitude inside the City of Harare.
 *
 * The stylized canvas approximates a rectangular slice of greater Harare's
 * peri-urban livestock zone. Coordinates can be mapped both ways so the
 * platform can seamlessly toggle between the stylized presentation and a
 * real OpenStreetMap basemap.
 */

/** Approximate bounding box of the City of Harare municipal footprint. */
export const HARARE_BOUNDS = {
  north: -17.65,
  south: -17.95,
  west: 30.95,
  east: 31.25,
} as const;

export const HARARE_CENTER: [number, number] = [
  (HARARE_BOUNDS.north + HARARE_BOUNDS.south) / 2,
  (HARARE_BOUNDS.east + HARARE_BOUNDS.west) / 2,
];

/** Convert a stylized [x, y] (0–100) into [lat, lng]. */
export function toLatLng(x: number, y: number): [number, number] {
  const lng =
    HARARE_BOUNDS.west + (x / 100) * (HARARE_BOUNDS.east - HARARE_BOUNDS.west);
  // y grows downward in the canvas; lat grows upward (south is smaller)
  const lat =
    HARARE_BOUNDS.north -
    (y / 100) * (HARARE_BOUNDS.north - HARARE_BOUNDS.south);
  return [lat, lng];
}

export function polygonToLatLng(points: [number, number][]) {
  return points.map(([x, y]) => toLatLng(x, y));
}

/**
 * Inverse of {@link toLatLng}: project a real coordinate back into the stylized
 * 0–100 canvas.
 *
 * The direction of travel matters. Positions are *stored* as lat/lng because
 * that is what a collar reports and what PostGIS can reason about; the canvas is
 * only a presentation space. Anything outside the Harare bounds clamps to the
 * edge rather than drawing off-canvas.
 */
export function toCanvas(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - HARARE_BOUNDS.west) / (HARARE_BOUNDS.east - HARARE_BOUNDS.west)) * 100;
  const y = ((HARARE_BOUNDS.north - lat) / (HARARE_BOUNDS.north - HARARE_BOUNDS.south)) * 100;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return { x: clamp(x), y: clamp(y) };
}

export function polygonToCanvas(points: [number, number][]): [number, number][] {
  return points.map(([lat, lng]) => {
    const { x, y } = toCanvas(lat, lng);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as [number, number];
  });
}
