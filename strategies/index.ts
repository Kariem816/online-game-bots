import { MapMessage, StateMessage } from "../msgs";

type MoveAction = {
	type: "move";
	direction: "left" | "right" | "up" | "down";
};

type StopAction = {
	type: "stop";
	direction: "left" | "right" | "up" | "down";
};

type ShootAction = {
	type: "shoot";
};

type LookAction = {
	type: "look";
	at: { x: number; y: number };
};

export type Action = MoveAction | StopAction | ShootAction | LookAction;

export type BotStrategyContext = {
	id: number;
	map: MapMessage;
	state: StateMessage;
};

export interface BotStrategy {
	name: string;
	getAction: (context: BotStrategyContext) => Action;
}

export * from "./random";
