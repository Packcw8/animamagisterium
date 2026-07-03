export type MapCameraPoint = {
  x: number;
  y: number;
};

export type MapCameraSize = {
  width: number;
  height: number;
};

export const PLAYER_MAP_SCALE = 0.62;
export const ADMIN_MAP_SCALE = 0.86;

function clampOffset(offset: number, surfaceSize: number, viewportSize: number) {
  if (surfaceSize <= viewportSize) {
    return (viewportSize - surfaceSize) / 2;
  }

  return Math.min(0, Math.max(viewportSize - surfaceSize, offset));
}

export function getCenteredMapOffset(
  playerPosition: MapCameraPoint,
  mapSize: MapCameraSize,
  viewportSize: MapCameraSize,
) {
  const playerX = (playerPosition.x / 100) * mapSize.width;
  const playerY = (playerPosition.y / 100) * mapSize.height;

  return {
    left: clampOffset(viewportSize.width / 2 - playerX, mapSize.width, viewportSize.width),
    top: clampOffset(viewportSize.height / 2 - playerY, mapSize.height, viewportSize.height),
  };
}

export function getCenteredMapScroll(
  playerPosition: MapCameraPoint,
  mapSize: MapCameraSize,
  viewportSize: MapCameraSize,
) {
  const playerX = (playerPosition.x / 100) * mapSize.width;
  const playerY = (playerPosition.y / 100) * mapSize.height;

  return {
    left: Math.max(0, playerX - viewportSize.width / 2),
    top: Math.max(0, playerY - viewportSize.height / 2),
  };
}
