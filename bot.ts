import fs from "fs";
import {
	decodeMsg,
	encodeMsg,
	isConnectedMessage,
	isErrorMessage,
	isJoinedMessage,
	isLeftMessage,
	isMapMessage,
	isShotMessage,
	isStateMessage,
	Messages,
} from "./msgs";
import { BotStrategy } from "./strategies";

import type { ConnectedMessage, MapMessage, StateMessage } from "./msgs";

export type BotState = "Connecting" | "Active" | "Inactive";
export type BotGameState = "Idle" | "InRoom" | "Playing";

export class GameBot {
	ws: WebSocket;
	botState: BotState = "Connecting";
	botGameState: BotGameState = "Idle";
	inactiveReason: string | null = null;
	logFile: number;
	player: ConnectedMessage | null = null;
	gameState: StateMessage | null = null;
	map: MapMessage | null = null;

	constructor(public id: number, public strategy: BotStrategy, url: string) {
		this.ws = new WebSocket(url);
		this.ws.binaryType = "arraybuffer";
		this.setupListeners();

		const filePath = `./logs/${id}.log`;
		if (!fs.existsSync(filePath)) {
			fs.writeFileSync(filePath, "");
		}
		this.logFile = fs.openSync(filePath, "w");
		fs.appendFileSync(this.logFile, "Connecting...\n");
	}

	setupListeners() {
		this.ws.addEventListener("error", (ev) => {
			// @ts-expect-error bun types are bad
			this.log(`Error: ${ev.message}`);
			this.botState = "Inactive";
			// @ts-expect-error bun types are bad
			this.inactiveReason = ev.message;
		});
		this.ws.addEventListener("open", () => {
			this.log("Connected");
			this.botState = "Active";
		});
		this.ws.addEventListener("message", (ev) => {
			const message = decodeMsg(ev.data);
			if (isConnectedMessage(message)) {
				this.player = message.data;
				this.log(`Playing as ${message.data.username}`);
			} else if (isJoinedMessage(message)) {
				this.botGameState = "InRoom";
				this.log(`Joined room ${message.data.room}`);
			} else if (isLeftMessage(message)) {
				this.botGameState = "Idle";
				this.log("Left room");
			} else if (isStateMessage(message)) {
				this.gameState = message.data;
				// TODO: add GamePhases enum
				if (message.data.state.phase === 2) {
					this.botGameState = "Playing";
				} else {
					this.botGameState = "InRoom";
				}
			} else if (isMapMessage(message)) {
				this.map = message.data;
			} else if (isShotMessage(message)) {
				for (const { x, y, state } of message.data.cells) {
					this.map!.tiles[y * this.map!.width + x] = state;
				}
			} else if (isErrorMessage(message)) {
				this.log(`Error: ${message.data.message}`);
			}
		});
	}

	async connect(): Promise<void> {
		while (this.botState === "Connecting") {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		if (this.botState === "Inactive") {
			throw new Error(this.inactiveReason!);
		}
	}

	log(data: string) {
		fs.appendFileSync(this.logFile, `${data}\n`);
	}

	update() {
		if (this.botState !== "Active") return;
		if (this.botGameState !== "Playing") return;

		const action = this.strategy.getAction({
			map: this.map!,
			state: this.gameState!,
			id: this.player!.id,
		});

		switch (action.type) {
			case "move":
				this.startMoving(action.direction);
				break;
			case "stop":
				this.stopMoving(action.direction);
				break;
			case "shoot":
				this.shoot();
				break;
			case "look":
				this.moveMouse(action.at);
				break;
			case "idle":
				break;
		}
	}

	leave() {
		if (this.botState !== "Active") return;
		if (this.botGameState === "Idle")
			return this.log("Asked to leave while idle");
		this.ws.send(encodeMsg({ type: Messages.MSG_LEAVE, data: {} }));
		this.log("Sent leave");
	}

	join(room: string) {
		if (this.botState !== "Active") return;
		if (this.botGameState === "InRoom")
			return this.log("Asked to join while in room");
		this.ws.send(encodeMsg({ type: Messages.MSG_JOIN, data: { room } }));
		this.log(`Sent join ${room}`);
	}

	close() {
		this.ws.close(1000);
		this.log("Closed");
		fs.closeSync(this.logFile);
	}

	startMoving(direction: "left" | "right" | "up" | "down") {
		this.ws.send(
			encodeMsg({
				type: Messages.MSG_MOVE,
				data: { direction, start: true },
			})
		);
	}

	stopMoving(direction: "left" | "right" | "up" | "down") {
		this.ws.send(
			encodeMsg({
				type: Messages.MSG_MOVE,
				data: { direction, start: false },
			})
		);
	}

	moveMouse(to: { x: number; y: number }) {
		this.ws.send(
			encodeMsg({
				type: Messages.MSG_MOUSE,
				data: to,
			})
		);
	}

	shoot() {
		this.ws.send(
			encodeMsg({
				type: Messages.MSG_SHOOT,
				data: {},
			})
		);
	}

	get botName() {
		return `Bot ${this.id}`;
	}

	get playerId() {
		return this.player?.id;
	}

	get playerName() {
		return this.player?.username;
	}
}
