import { Action, BotStrategy, BotStrategyContext } from ".";

const actions = ["move", "stop", "shoot", "look"];
const directions = ["left", "right", "up", "down"] as const;

export class RandomStrategy implements BotStrategy {
	name = "Random";
	getAction(context: BotStrategyContext): Action {
		const actionType = actions[Math.floor(Math.random() * actions.length)];

		if (actionType === "move") {
			const direction =
				directions[Math.floor(Math.random() * directions.length)];
			return { type: "move", direction };
		} else if (actionType === "stop") {
			const direction =
				directions[Math.floor(Math.random() * directions.length)];
			return { type: "stop", direction };
		} else if (actionType === "shoot") {
			return { type: "shoot" };
		} else if (actionType === "look") {
			const maxX = context.map.width - 1;
			const maxY = context.map.height - 1;
			const x = Math.floor(Math.random() * maxX);
			const y = Math.floor(Math.random() * maxY);

			return { type: "look", at: { x, y } };
		} else {
			throw new Error("Unreachable");
		}
	}
}
