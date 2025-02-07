import { GameBot } from "./bot";
import { RandomStrategy } from "./strategies";

const WS_URL = "ws://localhost:3000/ws";
const TicksPerSecond = 60;
const TickTime = 1000 / TicksPerSecond;

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
		const bot = new GameBot(i + 1, new RandomStrategy(), WS_URL);
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
