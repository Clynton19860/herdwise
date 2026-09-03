import test from "node:test";
import assert from "node:assert/strict";
import { polygonToThumbnail, toCanvas } from "../lib/geo.ts";

/**
 * A zone preview has to show the zone.
 *
 * The thumbnail on the geofences list projected through `toCanvas`, which maps
 * into a fixed Harare-wide box. Two things broke as a result, and the second is
 * total: a small field spans a few hundredths of a degree against a box a third
 * of a degree wide, so its vertices round together — and a field drawn outside
 * Harare clamps every vertex to the same corner, leaving a polygon with no area
 * and a thumbnail showing nothing at all.
 */

// The ring of a zone drawn on a bench in Johannesburg, well outside Harare.
const JOHANNESBURG: [number, number][] = [
  [-26.118487, 28.131013],
  [-26.118458, 28.131687],
  [-26.118463, 28.131687],
  [-26.118496, 28.130988],
];

test("the Harare projection collapses a zone drawn elsewhere", () => {
  const projected = JOHANNESBURG.map(([lat, lng]) => toCanvas(lat, lng));
  const distinct = new Set(projected.map((p) => `${p.x},${p.y}`));
  assert.equal(distinct.size, 1, "every vertex clamps to the same corner — this is the bug");
});

test("a thumbnail is normalised to its own extent, so it shows the shape", () => {
  const t = polygonToThumbnail(JOHANNESBURG);
  const distinct = new Set(t.map((p) => p.join(",")));
  assert.ok(distinct.size > 1, "the vertices are no longer on top of each other");

  const xs = t.map((p) => p[0]);
  const ys = t.map((p) => p[1]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 50, "the shape fills the frame horizontally");
  for (const v of [...xs, ...ys]) {
    assert.ok(v >= 0 && v <= 100, "and stays inside the viewBox");
  }
});

test("a tiny field inside Harare is just as visible as a large one", () => {
  // Roughly 50 m across, which is what a homestead paddock actually is.
  const small: [number, number][] = [
    [-17.8805, 30.9975], [-17.8805, 30.9980],
    [-17.8810, 30.9980], [-17.8810, 30.9975],
  ];
  const t = polygonToThumbnail(small);
  const xs = t.map((p) => p[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 50, "a small paddock still fills its preview");
});

test("aspect ratio is kept, so a strip does not look like a square", () => {
  const strip: [number, number][] = [
    [-17.8800, 30.9900], [-17.8800, 31.0100],
    [-17.8802, 31.0100], [-17.8802, 30.9900],
  ];
  const t = polygonToThumbnail(strip);
  const w = Math.max(...t.map((p) => p[0])) - Math.min(...t.map((p) => p[0]));
  const h = Math.max(...t.map((p) => p[1])) - Math.min(...t.map((p) => p[1]));
  assert.ok(w > h * 5, "a long thin field still reads as long and thin");
});

test("a ring with no extent draws a dot rather than dividing by zero", () => {
  const degenerate: [number, number][] = [
    [-17.88, 30.99], [-17.88, 30.99], [-17.88, 30.99],
  ];
  assert.deepEqual(polygonToThumbnail(degenerate), [[50, 50], [50, 50], [50, 50]]);
  assert.deepEqual(polygonToThumbnail([]), []);
});
