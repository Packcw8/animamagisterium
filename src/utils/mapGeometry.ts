export const MAP_SIZE = { width: 1800, height: 1400 };
export type MapDimensions = typeof MAP_SIZE;

export type PercentPoint = {
  x: number;
  y: number;
};

export type PathSegmentVisibility = "visible" | "hidden" | "cave" | "fog";

export type PathSegmentMeta = {
  from_index: number;
  to_index: number;
  visibility: PathSegmentVisibility;
  label?: string | null;
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

export function normalizePathSegments(segments: PathSegmentMeta[] | null | undefined, pointCount: number): PathSegmentMeta[] {
  const maxSegmentIndex = Math.max(0, pointCount - 2);
  return (segments ?? [])
    .map((segment) => ({
      from_index: Math.max(0, Math.min(maxSegmentIndex, Math.trunc(Number(segment.from_index) || 0))),
      to_index: Math.max(1, Math.min(pointCount - 1, Math.trunc(Number(segment.to_index) || 1))),
      visibility: isPathSegmentVisibility(segment.visibility) ? segment.visibility : "visible",
      label: segment.label?.trim() || null,
    }))
    .filter((segment) => pointCount >= 2 && segment.to_index === segment.from_index + 1 && segment.visibility !== "visible")
    .filter((segment, index, all) => all.findIndex((item) => item.from_index === segment.from_index && item.to_index === segment.to_index) === index);
}

export function getPathSegmentMeta(segments: PathSegmentMeta[] | null | undefined, segmentIndex: number): PathSegmentMeta {
  return (segments ?? []).find((segment) => Number(segment.from_index) === segmentIndex && Number(segment.to_index) === segmentIndex + 1) ?? {
    from_index: segmentIndex,
    to_index: segmentIndex + 1,
    visibility: "visible",
    label: null,
  };
}

export function getRouteSegmentIndexAtProgress(points: PercentPoint[], progressPercent: number) {
  if (points.length < 2) {
    return 0;
  }

  const target = clamp(progressPercent, 0, 100) / 100;
  const segmentLengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const total = segmentLengths.reduce((sum, value) => sum + value, 0);
  let traveled = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const nextTraveled = traveled + segmentLengths[index];
    if (target * total <= nextTraveled) {
      return index;
    }
    traveled = nextTraveled;
  }

  return segmentLengths.length - 1;
}

export function getPathSegmentMetaAtProgress(points: PercentPoint[], segments: PathSegmentMeta[] | null | undefined, progressPercent: number) {
  return getPathSegmentMeta(segments, getRouteSegmentIndexAtProgress(points, progressPercent));
}

export function isConcealedPathSegment(segment: PathSegmentMeta | null | undefined) {
  return segment?.visibility === "hidden" || segment?.visibility === "cave";
}

function isPathSegmentVisibility(value: unknown): value is PathSegmentVisibility {
  return value === "visible" || value === "hidden" || value === "cave" || value === "fog";
}
