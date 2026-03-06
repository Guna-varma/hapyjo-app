/**
 * Survey parser and cubature tests.
 * Verifies TOP/Depth format: pointId, X (Easting), Y (Northing), Z (Altitude), ... (extra columns ignored).
 */
jest.mock('delaunator', () => ({
  __esModule: true,
  default: class MockDelaunator {
    triangles: number[];
    halfedges: number[];
    constructor(_coords: number[]) {
      this.triangles = [];
      this.halfedges = [];
    }
  },
}));

import { parseSurveyFileContent, parseAndMergeSurveyFiles, computeCubature, computeWorkVolume } from '../surveyParser';

describe('parseSurveyFileContent', () => {
  it('parses TOP format with 6 columns (pointId, X, Y, Z, code, offset)', () => {
    const content = [
      'pt0,4746483.0150,492544.8142,1419.0430,98140.0000,-11.2702',
      'pt1,4746479.1599,492543.7451,1419.0129,98140.0000,-15.0887',
      'pt2,4746470.6047,492544.0957,1418.0723,98140.0000,-23.6508',
    ].join('\n');
    const points = parseSurveyFileContent(content);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({
      pointId: 'pt0',
      x: 4746483.015,
      y: 492544.8142,
      elevation: 1419.043,
    });
    expect(points[1].elevation).toBe(1419.0129);
    expect(points[2].x).toBe(4746470.6047);
  });

  it('parses Depth format with 6 columns (pointId, X, Y, Z, 0, 0)', () => {
    const content = [
      'pt0,4746486.3917,492580.3485,1417.6798,0.0000,0.0000',
      'pt1,4746484.5183,492581.7708,1417.6998,0.0000,0.0000',
    ].join('\n');
    const points = parseSurveyFileContent(content);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({
      pointId: 'pt0',
      x: 4746486.3917,
      y: 492580.3485,
      elevation: 1417.6798,
    });
  });

  it('deduplicates by (x,y) to 4 decimals', () => {
    const content = [
      'pt0,100.0000,200.0000,10.0,0,0',
      'pt1,100.00001,200.00001,11.0,0,0', // same key after toFixed(4)
    ].join('\n');
    const points = parseSurveyFileContent(content);
    expect(points).toHaveLength(1);
    expect(points[0].pointId).toBe('pt0');
  });

  it('skips lines with invalid numbers', () => {
    const content = [
      'pt1,a,b,c',
      'pt2,10,20,30,0,0',
    ].join('\n');
    const points = parseSurveyFileContent(content);
    expect(points).toHaveLength(1);
    expect(points[0].elevation).toBe(30);
  });
});

describe('computeCubature', () => {
  it('returns zeros when before has < 3 points', () => {
    const before = [
      { pointId: 'a', x: 0, y: 0, elevation: 10 },
      { pointId: 'b', x: 1, y: 0, elevation: 10 },
    ];
    const after = [
      { pointId: 'c', x: 0, y: 0, elevation: 8 },
      { pointId: 'd', x: 1, y: 0, elevation: 8 },
      { pointId: 'e', x: 0.5, y: 1, elevation: 8 },
    ];
    const r = computeCubature(before, after);
    expect(r.totalCut).toBe(0);
    expect(r.totalFill).toBe(0);
    expect(r.triangleCount).toBe(0);
  });

  it('returns cubature result shape (Delaunator mocked so triangleCount may be 0)', () => {
    const before = [
      { pointId: 'a', x: 0, y: 0, elevation: 10 },
      { pointId: 'b', x: 10, y: 0, elevation: 10 },
      { pointId: 'c', x: 5, y: 10, elevation: 10 },
    ];
    const after = [
      { pointId: 'a', x: 0, y: 0, elevation: 8 },
      { pointId: 'b', x: 10, y: 0, elevation: 8 },
      { pointId: 'c', x: 5, y: 10, elevation: 8 },
    ];
    const r = computeCubature(before, after);
    expect(r).toHaveProperty('totalCut');
    expect(r).toHaveProperty('totalFill');
    expect(r).toHaveProperty('surfaceUtile');
    expect(r).toHaveProperty('triangleCount');
    expect(typeof r.totalCut).toBe('number');
    expect(typeof r.surfaceUtile).toBe('number');
  });
});

describe('computeWorkVolume', () => {
  it('returns totalCut from computeCubature', () => {
    const before = [
      { pointId: 'a', x: 0, y: 0, elevation: 10 },
      { pointId: 'b', x: 10, y: 0, elevation: 10 },
      { pointId: 'c', x: 5, y: 10, elevation: 10 },
    ];
    const after = [
      { pointId: 'a', x: 0, y: 0, elevation: 8 },
      { pointId: 'b', x: 10, y: 0, elevation: 8 },
      { pointId: 'c', x: 5, y: 10, elevation: 8 },
    ];
    const vol = computeWorkVolume(before, after);
    const { totalCut } = computeCubature(before, after);
    expect(vol).toBe(totalCut);
  });
});
