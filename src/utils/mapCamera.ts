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

export function getCenteredMapOffset(
  playerPosition: MapCameraPoint,
  mapSize: MapCameraSize,
  viewportSize: MapCameraSize,
) {
  const playerX = (playerPosition.x / 100) * mapSize.width;
  const playerY = (playerPosition.y / 100) * mapSize.height;

  return {
    left: viewportSize.width / 2 - playerX,
    top: viewportSize.height / 2 - playerY,
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
