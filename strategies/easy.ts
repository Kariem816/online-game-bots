// strategies/easy.ts
import { Direction, directions, Team, Tile } from "../consts";
import { MapMessage } from "../msgs";
import { BotStrategy, BotStrategyContext, Action } from "./index";

type TileWithDimensions = {
	tile: Tile;
	x: number;
	y: number;
};

type ShotTile = {
	tile: Tile;
	since: number;
};

export class EasyStrategy implements BotStrategy {
	name = "Easy";

	// Tracks the number of ticks since a given tile was shot.
	private shotTiles: Record<string, ShotTile> = {};

	getAction(context: BotStrategyContext): Action {
		const { map, state } = context;
		const player = state.players.find((p) => p.user.id === context.id);
		if (!player) {
			throw new Error("Player not found");
		}

		const teamTile = player.team === Team.TeamA ? Tile.TeamA : Tile.TeamB;
		const isMoving = player.vx !== 0 || player.vy !== 0;

		const tileId = ({ x, y }: TileWithDimensions): string =>
			`${x + y * map.width}`;

		// look around to check for paintable tiles
		const adjacentTiles = this.getAdjacentTiles(map, player.x, player.y);
		const paintableTiles = adjacentTiles.filter(
			(t) => t.tile !== Tile.Wall && t.tile !== teamTile
		);
		const paintableNotShotTiles = paintableTiles.filter(
			(t) => (this.shotTiles[tileId(t)]?.since ?? 0) <= 3
		);

		// If there are any adjacent tiles that can be painted...
		if (paintableNotShotTiles.length > 0) {
			if (isMoving) {
				// Stop moving before shooting.
				return {
					type: "stop",
					direction: this.getDirectionFromVelocity(
						player.vx,
						player.vy
					),
				};
			} else {
				const targetTile =
					paintableNotShotTiles[
						Math.floor(Math.random() * paintableNotShotTiles.length)
					];
				const targetTheta = Math.atan2(
					targetTile.y - player.y,
					targetTile.x - player.x
				);
				// check if you are looking at them
				if (Math.abs(player.theta - targetTheta) < Math.PI / 8) {
					const id = tileId(targetTile);
					this.shotTiles[id] = this.shotTiles[id]
						? {
								tile: targetTile.tile,
								since: this.shotTiles[id].since + 1,
						  }
						: { tile: targetTile.tile, since: 0 };
					return { type: "shoot" };
				} else {
					// look at it
					return {
						type: "look",
						at: { x: targetTile.x, y: targetTile.y },
					};
				}
			}
		} else {
			// No adjacent paintable tile exists.
			if (isMoving) {
				// Determine the next tile based on current velocity.
				const nextX = Math.round(player.x + player.vx);
				const nextY = Math.round(player.y + player.vy);
				if (
					nextX < 0 ||
					nextX >= map.width ||
					nextY < 0 ||
					nextY >= map.height ||
					map.tiles[nextY * map.width + nextX] === Tile.Wall
				) {
					// If heading out-of-bounds or into a wall, stop.
					return {
						type: "stop",
						direction: this.getDirectionFromVelocity(
							player.vx,
							player.vy
						),
					};
				}
				// Otherwise, keep moving.
				return { type: "idle" };
			} else {
				// Not moving and no adjacent paintable tile? Move in a random direction.
				return { type: "move", direction: this.getRandomDirection() };
			}
		}
	}

	private getAdjacentTiles(
		map: MapMessage,
		x: number,
		y: number
	): TileWithDimensions[] {
		const tiles: TileWithDimensions[] = [];
		const tileX = Math.round(x);
		const tileY = Math.round(y);
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				const adjX = tileX + dx;
				const adjY = tileY + dy;
				if (
					adjX < 0 ||
					adjX >= map.width ||
					adjY < 0 ||
					adjY >= map.height
				)
					continue;
				const tile = map.tiles[adjY * map.width + adjX];
				tiles.push({ tile, x: adjX, y: adjY });
			}
		}
		return tiles;
	}

	private getRandomDirection(): Direction {
		return directions[Math.floor(Math.random() * directions.length)];
	}

	private getDirectionFromVelocity(vx: number, vy: number): Direction {
		if (vx > 0) return "right";
		if (vx < 0) return "left";
		if (vy > 0) return "down";
		if (vy < 0) return "up";
		throw new Error("Unreachable");
	}

	// private logMap(map: MapMessage) {
	// 	let hAxeLine = "    ";
	// 	for (let x = 0; x < map.width; x++) {
	// 		hAxeLine = hAxeLine.concat(x.toString().padStart(3, " "));
	// 	}
	// 	this.log(hAxeLine);

	// 	for (let y = 0; y < map.height; y++) {
	// 		let line = y.toString().padStart(2, " ") + " |";
	// 		for (let x = 0; x < map.width; x++) {
	// 			const tile = map.tiles[y * map.width + x];
	// 			switch (tile) {
	// 				case Tile.Wall:
	// 					line = line.concat("  |");
	// 					break;
	// 				case Tile.TeamA:
	// 					line = line.concat("  A");
	// 					break;
	// 				case Tile.TeamB:
	// 					line = line.concat("  B");
	// 					break;
	// 				default:
	// 					line = line.concat("  .");
	// 			}
	// 		}
	// 		this.log(line);
	// 	}
	// }
}
