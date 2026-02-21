/**
 * Parse survey Before/After file format: pointId,x,y,elevation,?,?
 * Column index 3 (0-based) is elevation.
 */

export interface SurveyPoint {
  pointId: string;
  elevation: number;
}

const ELEVATION_COLUMN_INDEX = 3;

export function parseSurveyFileContent(content: string): SurveyPoint[] {
  const lines = content.trim().split(/\r?\n/).filter((line) => line.trim());
  const points: SurveyPoint[] = [];

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length <= ELEVATION_COLUMN_INDEX) continue;

    const pointId = parts[0].trim();
    const elevationStr = parts[ELEVATION_COLUMN_INDEX].trim();
    const elevation = parseFloat(elevationStr);
    if (Number.isNaN(elevation)) continue;

    points.push({ pointId, elevation });
  }

  return points;
}

/**
 * Compute work volume from Before and After points.
 * Volume = sum over matched pointIds of (elevation_after - elevation_before).
 */
export function computeWorkVolume(
  beforePoints: SurveyPoint[],
  afterPoints: SurveyPoint[]
): number {
  const afterMap = new Map(afterPoints.map((p) => [p.pointId, p.elevation]));
  let sum = 0;
  let matched = 0;

  for (const before of beforePoints) {
    const elevAfter = afterMap.get(before.pointId);
    if (elevAfter === undefined) continue;
    matched += 1;
    sum += elevAfter - before.elevation;
  }

  return matched > 0 ? sum : 0;
}
