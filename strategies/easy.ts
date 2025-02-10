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

	private shotTiles: Record<string, ShotTile> = {};

	getAction(context: BotStrategyContext): Action {
		const map = context.map;
		const state = context.state;
		const player = state.players.find((p) => p.user.id === context.id);
		if (!player) {
			throw new Error("Player not found");
		}
		const teamTile = player.team === Team.TeamA ? Tile.TeamA : Tile.TeamB;

		// look around to check for paintable tiles
		const adjacentTiles = this.getAdjacentTiles(map, player.x, player.y);
		const paintableTiles = adjacentTiles.filter(
			(tile) => tile.tile !== Tile.Wall && tile.tile !== teamTile
		);
		const paintableNotShotTiles = paintableTiles.filter(
			(tile) =>
				(this.shotTiles[tile.x + tile.y * map.width]?.since ?? 0) <= 3
		);
		// if there are
		if (paintableNotShotTiles.length > 0) {
			// check if you are moving
			if (player.vx !== 0 || player.vy !== 0) {
				// stop
				const direction = this.getDirectionFromVelocity(
					player.vx,
					player.vy
				);
				return { type: "stop", direction };
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
					const tileId = targetTile.x + targetTile.y * map.width;
					if (this.shotTiles[tileId]) {
						this.shotTiles[tileId].since++;
					} else {
						this.shotTiles[tileId] = {
							tile: targetTile.tile,
							since: 0,
						};
					}
					// paint it
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
			// if you are already moving
			if (player.vx !== 0 || player.vy !== 0) {
				const nx = Math.round(player.x + player.vx);
				const ny = Math.round(player.y + player.vy);
				if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) {
					// if you are hitting the map boundry
					const direction = this.getDirectionFromVelocity(
						player.vx,
						player.vy
					);
					return { type: "stop", direction };
				}
				const nextTile = map.tiles[ny * map.width + nx];
				if (nextTile === Tile.Wall) {
					// if you are hitting a wall
					const direction = this.getDirectionFromVelocity(
						player.vx,
						player.vy
					);
					return { type: "stop", direction };
				}

				// keep moving
				return { type: "idle" };
			} else {
				// move in a random direction
				const direction = this.getRandomDirection();
				return { type: "move", direction };
			}
		}
	}

	private getAdjacentTiles(
		map: MapMessage,
		x: number,
		y: number
	): TileWithDimensions[] {
		const adjacentTiles: TileWithDimensions[] = [];
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				if (x + dx < 0 || x + dx >= map.width) continue;
				if (y + dy < 0 || y + dy >= map.height) continue;
				const tx = Math.round(x + dx);
				const ty = Math.round(y + dy);
				const tile = map.tiles[ty * map.width + tx];
				adjacentTiles.push({ tile, x: tx, y: ty });
			}
		}
		return adjacentTiles;
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
