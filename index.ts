import { GameBot } from "./bot";
import {
	RandomStrategy,
	EasyStrategy,
	// HardStrategy,
	BotStrategy,
} from "./strategies";

const WS_URL = "ws://localhost:3000/ws";

type Difficulty = "random" | "easy" | "hard";

async function main(argv: string[]) {
	let amount = 10;
	let room: string | undefined;
	let TicksPerSecond = 60;
	let diff: Difficulty = "random";

	for (let i = 1; i < argv.length; i++) {
		const arg = argv[i];
		if (
			arg.startsWith("-") &&
			arg.endsWith("amount") &&
			i + 1 < argv.length
		) {
			amount = parseInt(argv[++i]);
		}
		if (
			arg.startsWith("-") &&
			arg.endsWith("room") &&
			i + 1 < argv.length
		) {
			room = argv[++i];
		}
		if (
			((arg.startsWith("-") && arg.endsWith("tps")) ||
				(arg.startsWith("-") && arg.endsWith("ticks"))) &&
			i + 1 < argv.length
		) {
			TicksPerSecond = parseInt(argv[++i]);
			if (TicksPerSecond < 1) {
				console.log("Clamping ticks to 1. Bro Seriously WTF!");
				TicksPerSecond = 1;
			} else if (TicksPerSecond > 120) {
				console.log(
					"Clamping ticks to 120. We are not hogging NASA computers!"
				);
				TicksPerSecond = 120;
			}
		}
		if (
			arg.startsWith("-") &&
			arg.endsWith("difficulty") &&
			i + 1 < argv.length
		) {
			const difficulty = argv[++i].toLowerCase();
			if (difficulty === "random") {
				diff = "random";
			} else if (difficulty === "easy") {
				diff = "easy";
			} else if (difficulty === "hard") {
				diff = "hard";
				throw new Error("Hard mode not implemented yet");
			} else {
				throw new Error("Invalid difficulty");
			}
		}
	}

	if (!room) {
		throw new Error("Room not provided");
	}

	const TickTime = 1000 / TicksPerSecond;
	const strategy: new () => BotStrategy =
		diff === "random"
			? RandomStrategy
			: //  diff === "easy" ?
			  EasyStrategy;
	// : HardStrategy;
	let quit = false;

	process.stdin.on("data", (data) => {
		if (data.toString().trim() === "q") {
			console.log("Quitting...");
			quit = true;
		}
	});

	const bots = new Array<GameBot>(10);
	for (let i = 0; i < amount; i++) {
		const bot = new GameBot(i + 1, new strategy(), WS_URL);
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
