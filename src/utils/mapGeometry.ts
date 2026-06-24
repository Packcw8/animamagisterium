export const MAP_SIZE = { width: 1800, height: 1400 };
export type MapDimensions = typeof MAP_SIZE;

export type PercentPoint = {
  x: number;
  y: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

export function getPercentDistance(a: PercentPoint, b: PercentPoint) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function getPointOnRoute(points: PercentPoint[], progressPercent: number) {
  if (points.length === 0) {
    return { x: 50, y: 50 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const target = clamp(progressPercent, 0, 100) / 100;
  const segmentLengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const total = segmentLengths.reduce((sum, value) => sum + value, 0);
  let traveled = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segment = segmentLengths[index];
    const nextTraveled = traveled + segment;

    if (target * total <= nextTraveled) {
      const local = (target * total - traveled) / segment;
      const start = points[index];
      const end = points[index + 1];
      return {
        x: start.x + (end.x - start.x) * local,
        y: start.y + (end.y - start.y) * local,
      };
    }

    traveled = nextTraveled;
  }

  return points[points.length - 1];
}

export function getRouteSegments(points: PercentPoint[], dimensions: MapDimensions = MAP_SIZE) {
  const mapAspectRatio = dimensions.height / dimensions.width;

  return points.slice(1).map((point, index) => {
    const previous = points[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;

    return {
      left: previous.x,
      top: previous.y,
      length: Math.hypot(dx, dy * mapAspectRatio),
      angle: Math.atan2(dy * dimensions.height, dx * dimensions.width) * (180 / Math.PI),
    };
  });
}
