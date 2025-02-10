// HardStrategy.ts
import { Direction, directions, Team, Tile } from "../consts";
import { MapMessage, StateMessage } from "../msgs";
import { BotStrategy, BotStrategyContext, Action } from "./index";

// Helper type for players (matches the StateMessage.players objects)
type Player = StateMessage["players"][0];

export class HardStrategy implements BotStrategy {
	name = "Hard";

	// The current planned path (each node is a grid coordinate)
	private currentPath: { x: number; y: number }[] = [];
	// The current mode of behavior: expansion, defense, or aggressive.
	private mode: "expansion" | "defense" | "aggressive" = "expansion";

	getAction(context: BotStrategyContext): Action {
		const { map, state } = context;
		const player = state.players.find(
			(p) => p.user.id === context.id
		) as Player;
		if (!player) {
			throw new Error("Player not found");
		}

		// 1. Update mode based on enemy proximity and score.
		this.updateMode(state, player);

		// 2. Choose target tile based on mode.
		let targetTile: { x: number; y: number } | null = null;
		if (this.mode === "expansion") {
			targetTile = this.chooseExpansionTarget(map, player, state);
		} else if (this.mode === "defense") {
			targetTile = this.chooseDefensivePosition(map, player, state);
		} else if (this.mode === "aggressive") {
			targetTile = this.chooseAggressiveTarget(map, player, state);
		}

		if (!targetTile) {
			// Fallback: move randomly if no target could be chosen.
			return { type: "move", direction: this.getRandomDirection() };
		}

		// 3. Compute (or update) the path if needed.
		if (
			!this.currentPath.length ||
			!this.isPathValid(this.currentPath, map) ||
			!this.isPathForTarget(this.currentPath, targetTile)
		) {
			this.currentPath = this.computePath(player, targetTile, map);
		}

		// If no path found, move randomly.
		if (!this.currentPath.length) {
			return { type: "move", direction: this.getRandomDirection() };
		}

		// 4. Follow the computed path.
		const nextStep = this.currentPath[0];
		if (this.atPosition(player, nextStep)) {
			this.currentPath.shift();
		}
		// If path is now empty (we have arrived), try aiming and shooting.
		if (!this.currentPath.length) {
			const desiredAngle = Math.atan2(
				targetTile.y - player.y,
				targetTile.x - player.x
			);
			const angleDiff = Math.abs(
				this.normalizeAngle(desiredAngle - player.theta)
			);
			if (angleDiff < 0.1) {
				return { type: "shoot" };
			} else {
				return { type: "look", at: targetTile };
			}
		}

		// 5. Decide movement direction toward the next step.
		const desiredDirection = this.getDirectionTo(player, nextStep);
		// If not moving, or if moving in the wrong direction, adjust.
		if (player.vx === 0 && player.vy === 0) {
			return { type: "move", direction: desiredDirection };
		} else {
			const currentDirection = this.getDirectionFromVelocity(
				player.vx,
				player.vy
			);
			if (currentDirection !== desiredDirection) {
				return { type: "stop", direction: currentDirection };
			}
		}

		// 6. Adjust aim toward the target.
		const targetAngle = Math.atan2(
			targetTile.y - player.y,
			targetTile.x - player.x
		);
		const angleDiff = Math.abs(
			this.normalizeAngle(targetAngle - player.theta)
		);
		if (angleDiff > 0.1) {
			return { type: "look", at: targetTile };
		}

		// 7. Finally, if aligned and on course, shoot.
		return { type: "shoot" };
	}

	// ─── MODE AND TARGET SELECTION ─────────────────────────────────────────────

	/**
	 * Update the bot's mode (expansion, defense, or aggressive) based on enemy proximity
	 * and score.
	 */
	private updateMode(state: any, player: Player): void {
		// Find enemies (players not on our team).
		const enemies = state.players.filter(
			(p: Player) => p.team !== player.team
		);
		let minDist = Infinity;
		for (const enemy of enemies) {
			const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
			if (d < minDist) {
				minDist = d;
			}
		}

		if (minDist < 1.5) {
			this.mode = "defense";
		} else if (minDist < 3) {
			// Use score as a tiebreaker: if we are winning, press the advantage.
			const myScore =
				player.team === Team.TeamA
					? state.state.scoreA
					: state.state.scoreB;
			const enemyScore =
				player.team === Team.TeamA
					? state.state.scoreB
					: state.state.scoreA;
			this.mode = myScore >= enemyScore ? "aggressive" : "defense";
		} else {
			this.mode = "expansion";
		}
	}

	/**
	 * In expansion mode, choose the nearest tile (by center) that is not painted with our team’s color.
	 */
	private chooseExpansionTarget(
		map: MapMessage,
		player: Player,
		state: any
	): { x: number; y: number } | null {
		const teamTile = player.team === Team.TeamA ? Tile.TeamA : Tile.TeamB;
		let bestTarget: { x: number; y: number } | null = null;
		let bestDist = Infinity;
		for (let y = 0; y < map.height; y++) {
			for (let x = 0; x < map.width; x++) {
				const idx = y * map.width + x;
				const tile = map.tiles[idx];
				if (tile === Tile.Wall || tile === teamTile) continue;
				const centerX = x + 0.5;
				const centerY = y + 0.5;
				const d = Math.hypot(player.x - centerX, player.y - centerY);
				if (d < bestDist) {
					bestDist = d;
					bestTarget = { x: centerX, y: centerY };
				}
			}
		}
		return bestTarget;
	}

	/**
	 * In defense mode, target a position that is a few tiles away from the closest enemy.
	 */
	private chooseDefensivePosition(
		map: MapMessage,
		player: Player,
		state: any
	): { x: number; y: number } | null {
		const enemies = state.players.filter(
			(p: Player) => p.team !== player.team
		);
		if (enemies.length === 0) return null;
		let closestEnemy = enemies[0];
		let minDist = Math.hypot(
			player.x - closestEnemy.x,
			player.y - closestEnemy.y
		);
		for (const enemy of enemies) {
			const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
			if (d < minDist) {
				minDist = d;
				closestEnemy = enemy;
			}
		}
		// Compute a vector away from the closest enemy.
		let dx = player.x - closestEnemy.x;
		let dy = player.y - closestEnemy.y;
		const len = Math.hypot(dx, dy) || 1;
		dx /= len;
		dy /= len;
		// Choose an offset (e.g. 2 tiles away)
		const offset = 2;
		let targetX = player.x + dx * offset;
		let targetY = player.y + dy * offset;
		// Clamp to map boundaries and snap to tile center.
		const gridX = Math.min(map.width - 1, Math.max(0, Math.floor(targetX)));
		const gridY = Math.min(
			map.height - 1,
			Math.max(0, Math.floor(targetY))
		);
		return { x: gridX + 0.5, y: gridY + 0.5 };
	}

	/**
	 * In aggressive mode, target the nearest enemy’s position.
	 */
	private chooseAggressiveTarget(
		map: MapMessage,
		player: Player,
		state: any
	): { x: number; y: number } | null {
		const enemies = state.players.filter(
			(p: Player) => p.team !== player.team
		);
		if (enemies.length === 0) return null;
		let closestEnemy = enemies[0];
		let bestDist = Math.hypot(
			player.x - closestEnemy.x,
			player.y - closestEnemy.y
		);
		for (const enemy of enemies) {
			const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
			if (d < bestDist) {
				bestDist = d;
				closestEnemy = enemy;
			}
		}
		// Target the enemy's grid–center.
		const gridX = Math.floor(closestEnemy.x);
		const gridY = Math.floor(closestEnemy.y);
		return { x: gridX + 0.5, y: gridY + 0.5 };
	}

	// ─── PATHFINDING (A* IMPLEMENTATION) ─────────────────────────────────────────

	/**
	 * Compute a path from the player's current grid cell to the target cell.
	 */
	private computePath(
		player: Player,
		target: { x: number; y: number },
		map: MapMessage
	): { x: number; y: number }[] {
		// Use grid coordinates (cell indices) for pathfinding.
		const startX = Math.floor(player.x);
		const startY = Math.floor(player.y);
		const targetX = Math.floor(target.x);
		const targetY = Math.floor(target.y);

		interface Node {
			x: number;
			y: number;
			f: number;
			g: number;
			h: number;
			parent: Node | null;
		}

		const openSet: Node[] = [];
		// Create a 2D array for closed nodes.
		const closedSet: boolean[][] = Array.from({ length: map.height }, () =>
			Array(map.width).fill(false)
		);

		// Manhattan distance heuristic.
		function heuristic(x: number, y: number): number {
			return Math.abs(x - targetX) + Math.abs(y - targetY);
		}

		// A cell is walkable if it's in bounds and not a wall.
		function isWalkable(x: number, y: number): boolean {
			if (x < 0 || y < 0 || x >= map.width || y >= map.height)
				return false;
			const tile = map.tiles[y * map.width + x];
			return tile !== Tile.Wall;
		}

		const startNode: Node = {
			x: startX,
			y: startY,
			g: 0,
			h: heuristic(startX, startY),
			f: 0,
			parent: null,
		};
		startNode.f = startNode.g + startNode.h;
		openSet.push(startNode);

		// Only cardinal moves.
		const neighborDirs = [
			{ dx: 1, dy: 0 },
			{ dx: -1, dy: 0 },
			{ dx: 0, dy: 1 },
			{ dx: 0, dy: -1 },
		];

		let goalNode: Node | null = null;
		while (openSet.length > 0) {
			// Get node with smallest f value.
			openSet.sort((a, b) => a.f - b.f);
			const current = openSet.shift()!;
			if (current.x === targetX && current.y === targetY) {
				goalNode = current;
				break;
			}
			closedSet[current.y][current.x] = true;
			for (const { dx, dy } of neighborDirs) {
				const nx = current.x + dx;
				const ny = current.y + dy;
				if (!isWalkable(nx, ny)) continue;
				if (closedSet[ny][nx]) continue;
				const tentativeG = current.g + 1;
				let neighbor = openSet.find((n) => n.x === nx && n.y === ny);
				if (!neighbor) {
					neighbor = {
						x: nx,
						y: ny,
						g: tentativeG,
						h: heuristic(nx, ny),
						f: tentativeG + heuristic(nx, ny),
						parent: current,
					};
					openSet.push(neighbor);
				} else if (tentativeG < neighbor.g) {
					neighbor.g = tentativeG;
					neighbor.f = neighbor.g + neighbor.h;
					neighbor.parent = current;
				}
			}
		}

		// Reconstruct the path (list of grid coordinates).
		const path: { x: number; y: number }[] = [];
		if (goalNode) {
			let curr: Node | null = goalNode;
			while (curr) {
				path.push({ x: curr.x, y: curr.y });
				curr = curr.parent;
			}
			path.reverse();
		}
		return path;
	}

	/**
	 * Check that every node in the path is still walkable.
	 */
	private isPathValid(
		path: { x: number; y: number }[],
		map: MapMessage
	): boolean {
		for (const node of path) {
			if (
				node.x < 0 ||
				node.y < 0 ||
				node.x >= map.width ||
				node.y >= map.height
			)
				return false;
			if (map.tiles[node.y * map.width + node.x] === Tile.Wall)
				return false;
		}
		return true;
	}

	/**
	 * Verify that the current path ends at the target cell.
	 */
	private isPathForTarget(
		path: { x: number; y: number }[],
		target: { x: number; y: number }
	): boolean {
		if (!path.length) return false;
		const last = path[path.length - 1];
		const targetX = Math.floor(target.x);
		const targetY = Math.floor(target.y);
		return last.x === targetX && last.y === targetY;
	}

	// ─── MOVEMENT AND AIM HELPERS ────────────────────────────────────────────────

	/**
	 * Return true if the player is within a small tolerance of the center of the given grid node.
	 */
	private atPosition(
		player: Player,
		node: { x: number; y: number }
	): boolean {
		const centerX = node.x + 0.5;
		const centerY = node.y + 0.5;
		return Math.hypot(player.x - centerX, player.y - centerY) < 0.3;
	}

	/**
	 * Given the player’s position and a grid node, return the cardinal direction toward that node.
	 */
	private getDirectionTo(
		player: Player,
		node: { x: number; y: number }
	): Direction {
		const centerX = node.x + 0.5;
		const centerY = node.y + 0.5;
		const dx = centerX - player.x;
		const dy = centerY - player.y;
		if (Math.abs(dx) > Math.abs(dy)) {
			return dx > 0 ? "right" : "left";
		} else {
			return dy > 0 ? "down" : "up";
		}
	}

	/**
	 * Return a direction based on a given velocity vector.
	 */
	private getDirectionFromVelocity(vx: number, vy: number): Direction {
		if (vx > 0) return "right";
		if (vx < 0) return "left";
		if (vy > 0) return "down";
		if (vy < 0) return "up";
		return "up"; // fallback
	}

	/**
	 * Return a random cardinal direction.
	 */
	private getRandomDirection(): Direction {
		return directions[Math.floor(Math.random() * directions.length)];
	}

	/**
	 * Normalize an angle to the range [–π, π].
	 */
	private normalizeAngle(angle: number): number {
		while (angle > Math.PI) angle -= 2 * Math.PI;
		while (angle < -Math.PI) angle += 2 * Math.PI;
		return angle;
	}
}
