import { Direction } from "../consts";
import { MapMessage, StateMessage } from "../msgs";

type MoveAction = {
	type: "move";
	direction: Direction;
};

type StopAction = {
	type: "stop";
	direction: Direction;
};

type ShootAction = {
	type: "shoot";
};

type LookAction = {
	type: "look";
	at: { x: number; y: number };
};

type IdleAction = {
	type: "idle";
};

export type Action =
	| MoveAction
	| StopAction
	| ShootAction
	| LookAction
	| IdleAction;

export type BotStrategyContext = {
	id: number; // bot player id
	map: MapMessage;
	state: StateMessage;
};

export interface BotStrategy {
	name: string;
	getAction: (context: BotStrategyContext) => Action;
}

export * from "./random";
export * from "./easy";
export * from "./hard";
