import {
	ConnectedMessage,
	decodeMsg,
	encodeMsg,
	isConnectedMessage,
	isErrorMessage,
	isJoinedMessage,
	isLeftMessage,
	isMapMessage,
	isStateMessage,
	MapMessage,
	Messages,
	StateMessage,
} from "./msgs";
import fs from "fs";

const WS_URL = "ws://localhost:3000/ws";
const TicksPerSecond = 60;
const TickTime = 1000 / TicksPerSecond;

type BotState = "Connecting" | "Active" | "Inactive";
type BotGameState = "Idle" | "InRoom" | "Playing";

class GameBot {
	ws: WebSocket;
	botState: BotState = "Connecting";
	botGameState: BotGameState = "Idle";
	inactiveReason: string | null = null;
	logFile: number;
	player: ConnectedMessage | null = null;
	gameState: StateMessage | null = null;
	mapSize: {
		width: MapMessage["width"];
		height: MapMessage["height"];
	} | null = null;

	protected botActions = {
		pressUp: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOVE,
					data: { direction: "up", start: true },
				})
			),
		pressDown: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOVE,
					data: { direction: "down", start: true },
				})
			),
		pressLeft: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOVE,
					data: { direction: "left", start: true },
				})
			),
		pressRight: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOVE,
					data: { direction: "right", start: true },
				})
			),
		releaseUp: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOVE,
					data: { direction: "up", start: false },
				})
			),
		releaseDown: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOVE,
					data: { direction: "down", start: false },
				})
			),
		releaseLeft: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOVE,
					data: { direction: "left", start: false },
				})
			),
		releaseRight: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOVE,
					data: { direction: "right", start: false },
				})
			),
		moveMouse: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_MOUSE,
					data: {
						x: Math.floor(
							Math.random() * (this.mapSize?.width ?? 0)
						),
						y: Math.floor(
							Math.random() * (this.mapSize?.height ?? 0)
						),
					},
				})
			),
		shoot: (ws: WebSocket) =>
			ws.send(
				encodeMsg({
					type: Messages.MSG_SHOOT,
					data: {},
				})
			),
	};

	constructor(public id: number) {
		this.ws = new WebSocket(WS_URL);
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
			// console.log(ev.data);
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
				if (message.data.started) {
					this.botGameState = "Playing";
				} else {
					this.botGameState = "InRoom";
				}
			} else if (isMapMessage(message)) {
				this.mapSize = {
					width: message.data.width,
					height: message.data.height,
				};
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

	randomAction(): (ws: WebSocket) => void {
		const actions = Object.keys(this.botActions) as Array<
			keyof typeof this.botActions
		>;
		const action = actions[Math.floor(Math.random() * actions.length)];
		this.log(`Action: ${action}`);
		return this.botActions[action];
	}

	update() {
		if (this.botState !== "Active") return;
		if (this.botGameState !== "Playing") return;

		const action = this.randomAction();
		action(this.ws);
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

async function main(argv: string[]) {
	let amount = 10;
	let room: string | undefined;

	for (let i = 1; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--amount" && i + 1 < argv.length) {
			amount = parseInt(argv[++i]);
		}
		if (arg === "--room" && i + 1 < argv.length) {
			room = argv[++i];
		}
	}

	if (!room) {
		throw new Error("Room not provided");
	}

	let quit = false;

	process.stdin.on("data", (data) => {
		if (data.toString().trim() === "q") {
			console.log("Quitting...");
			quit = true;
		}
	});

	const bots = new Array<GameBot>(10);
	for (let i = 0; i < amount; i++) {
		const bot = new GameBot(i + 1);
		bots[i] = bot;
	}

	await Promise.all(
		bots.map((bot) => {
			return bot.connect();
		})
	).catch((err) => {
		console.error(err);
		bots.forEach((bot) => {
			bot.close();
		});
		process.exit(1);
	});

	bots.forEach((bot) => {
		bot.join(room);
	});

	await new Promise((resolve) => setTimeout(resolve, 1000));

	while (!quit) {
		await new Promise((resolve) => setTimeout(resolve, TickTime));
		bots.forEach((bot) => bot.update());
	}

	await new Promise((resolve) => setTimeout(resolve, 50));
	bots.forEach((bot) => {
		bot.close();
	});

	process.exit(0);
}

main(process.argv);
