/**
 * Survey file parser and TIN-based cubature (volume) calculation.
 *
 * File 1 (TOP / Before): pointId, Easting (X), Northing (Y), Altitude (Z), Code/Layer, Distance/Offset
 * File 2 (After):        pointId, Easting (X), Northing (Y), Altitude (Z), Attr1, Attr2
 *
 * --- EXACT FORMULA (COVADIS / TIN standard) ---
 *
 * 1. Build TIN (Delaunay) on Before points → triangles with vertices (X,Y,Z_before).
 * 2. For each triangle, get Z_after at the same (X,Y) vertices (interpolated from After surface).
 * 3. Height difference at each vertex:  h_i = Z_before_i − Z_after_i
 * 4. Horizontal (2D) area:  A = ½ |x₁(y₂−y₃) + x₂(y₃−y₁) + x₃(y₁−y₂)|
 * 5. Volume of this triangular prism:
 *      V = A × (h₁ + h₂ + h₃) / 3
 * 6. Total Cut (Déblai) = Σ V for all triangles where V > 0 (earth removed).
 *    Total Fill (Remblai) = Σ |V| for all triangles where V < 0 (earth added).
 *
 * Display: Total (cut) in m³ to 2 decimal places, same value for surveyor and all roles.
 */

import Delaunator from 'delaunator';

export interface SurveyPoint {
  pointId: string;
  x: number;
  y: number;
  elevation: number;
}

const X_COLUMN = 1;
const Y_COLUMN = 2;
const Z_COLUMN = 3;

/**
 * Parse survey CSV: pointId, x, y, elevation, ... (supports 5 or 6 columns).
 * Columns 1,2,3 are Easting (X), Northing (Y), Altitude (Z).
 */
export function parseSurveyFileContent(content: string): SurveyPoint[] {
  const lines = content.trim().split(/\r?\n/).filter((line) => line.trim());
  const points: SurveyPoint[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length <= Z_COLUMN) continue;

    const pointId = parts[0].trim();
    const x = parseFloat(parts[X_COLUMN].trim());
    const y = parseFloat(parts[Y_COLUMN].trim());
    const z = parseFloat(parts[Z_COLUMN].trim());
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) continue;

    const key = `${x.toFixed(4)}_${y.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    points.push({ pointId, x, y, elevation: z });
  }

  return points;
}

/**
 * Barycentric: is point (px,py) inside triangle (ax,ay)-(bx,by)-(cx,cy)? Uses signed areas.
 */
function pointInTriangle(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number
): boolean {
  const s = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  const t = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const u = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0);
}

/**
 * Interpolate Z at (px, py) using barycentric coordinates in triangle (a,b,c). Z = λa*za + λb*zb + λc*zc.
 */
function barycentricZ(
  px: number, py: number,
  ax: number, ay: number, za: number,
  bx: number, by: number, zb: number,
  cx: number, cy: number, zc: number
): number {
  const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denom) < 1e-15) return (za + zb + zc) / 3;
  const la = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
  const lb = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
  const lc = 1 - la - lb;
  return la * za + lb * zb + lc * zc;
}

/**
 * Interpolate Z at (x, y) from the After surface: use After TIN (barycentric in containing triangle)
 * if point lies inside a triangle; otherwise fallback to inverse-distance weighting.
 */
function interpolateZFromTIN(
  afterPoints: SurveyPoint[],
  afterCoords: number[],
  afterDelaunator: Delaunator,
  x: number,
  y: number
): number {
  const tri = afterDelaunator.triangles;
  for (let i = 0; i < tri.length; i += 3) {
    const i0 = tri[i];
    const i1 = tri[i + 1];
    const i2 = tri[i + 2];
    const ax = afterCoords[2 * i0];
    const ay = afterCoords[2 * i0 + 1];
    const bx = afterCoords[2 * i1];
    const by = afterCoords[2 * i1 + 1];
    const cx = afterCoords[2 * i2];
    const cy = afterCoords[2 * i2 + 1];
    if (pointInTriangle(x, y, ax, ay, bx, by, cx, cy)) {
      return barycentricZ(x, y, ax, ay, afterPoints[i0].elevation, bx, by, afterPoints[i1].elevation, cx, cy, afterPoints[i2].elevation);
    }
  }
  return interpolateZIDW(afterPoints, x, y);
}

/**
 * Fallback: interpolate Z at (x, y) using inverse-distance weighting (power 2), k nearest.
 */
function interpolateZIDW(points: SurveyPoint[], x: number, y: number, k: number = 5): number {
  if (points.length === 0) return 0;
  const withDist = points.map((p) => {
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1e-10;
    return { z: p.elevation, w: 1 / (d * d) };
  });
  withDist.sort((a, b) => b.w - a.w);
  const top = withDist.slice(0, k);
  let sumW = 0;
  let sumWZ = 0;
  for (const { z, w } of top) {
    sumW += w;
    sumWZ += w * z;
  }
  return sumW > 0 ? sumWZ / sumW : points[0].elevation;
}

/**
 * Triangle area in 2D (horizontal) from three points (X,Y).
 */
function triangleArea2D(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number
): number {
  return Math.abs((ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) / 2);
}

export interface CubatureResult {
  /** Total cut volume (Déblai), m³ - earth removed */
  totalCut: number;
  /** Total fill volume (Remblai), m³ - earth added */
  totalFill: number;
  /** Useful surface area (overlap), m² */
  surfaceUtile: number;
  /** Number of triangles in TIN used */
  triangleCount: number;
}

/**
 * Compute cubature: TIN on Before, Z_after from After TIN (barycentric) or IDW fallback.
 * Formula: V = A × (h₁ + h₂ + h₃) / 3  per triangle; h_i = Z_before_i − Z_after_i.
 */
export function computeCubature(
  beforePoints: SurveyPoint[],
  afterPoints: SurveyPoint[]
): CubatureResult {
  if (beforePoints.length < 3 || afterPoints.length < 1) {
    return { totalCut: 0, totalFill: 0, surfaceUtile: 0, triangleCount: 0 };
  }

  const beforeCoords: number[] = [];
  for (const p of beforePoints) beforeCoords.push(p.x, p.y);
  const dBefore = new Delaunator(beforeCoords);
  const triangles = dBefore.triangles;

  const afterCoords: number[] = [];
  for (const p of afterPoints) afterCoords.push(p.x, p.y);
  const dAfter = afterPoints.length >= 3 ? new Delaunator(afterCoords) : null;

  const getZAfter = (x: number, y: number): number =>
    dAfter
      ? interpolateZFromTIN(afterPoints, afterCoords, dAfter, x, y)
      : interpolateZIDW(afterPoints, x, y);

  let totalCut = 0;
  let totalFill = 0;
  let surfaceUtile = 0;

  for (let i = 0; i < triangles.length; i += 3) {
    const i0 = triangles[i];
    const i1 = triangles[i + 1];
    const i2 = triangles[i + 2];
    const p0 = beforePoints[i0];
    const p1 = beforePoints[i1];
    const p2 = beforePoints[i2];

    const z1_0 = p0.elevation;
    const z1_1 = p1.elevation;
    const z1_2 = p2.elevation;

    const z2_0 = getZAfter(p0.x, p0.y);
    const z2_1 = getZAfter(p1.x, p1.y);
    const z2_2 = getZAfter(p2.x, p2.y);

    const h0 = z1_0 - z2_0;
    const h1 = z1_1 - z2_1;
    const h2 = z1_2 - z2_2;

    const A = triangleArea2D(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
    const V = A * (h0 + h1 + h2) / 3;

    surfaceUtile += A;
    if (V > 0) totalCut += V;
    else totalFill += Math.abs(V);
  }

  return {
    totalCut,
    totalFill,
    surfaceUtile,
    triangleCount: triangles.length / 3,
  };
}

/**
 * Work volume for display: total cut (earth removed) in m³.
 * Kept for backward compatibility; use computeCubature for cut/fill/surface.
 */
export function computeWorkVolume(
  beforePoints: SurveyPoint[],
  afterPoints: SurveyPoint[]
): number {
  const { totalCut } = computeCubature(beforePoints, afterPoints);
  return totalCut;
}

/**
 * Merge multiple survey point arrays (e.g. from multiple TOP files) into one set.
 * Deduplicates by (x,y) so the TIN has unique vertices; keeps first occurrence.
 */
export function mergeSurveyPoints(pointArrays: SurveyPoint[][]): SurveyPoint[] {
  const seen = new Set<string>();
  const out: SurveyPoint[] = [];
  for (const points of pointArrays) {
    for (const p of points) {
      const key = `${p.x.toFixed(4)}_${p.y.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/**
 * Parse multiple file contents and merge into one point set (for multiple TOP files).
 */
export function parseAndMergeSurveyFiles(contents: string[]): SurveyPoint[] {
  const pointArrays = contents.filter((c) => c.trim()).map(parseSurveyFileContent);
  return mergeSurveyPoints(pointArrays);
}
