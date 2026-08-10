import { GameBot } from "./bot";
import { BotStrategy } from "./strategies";

export class BotManager {
	private bots: GameBot[];
	constructor(
		public strategy: BotStrategy,
		public amount: number,
		public room: string,
		private wsUrl: string,
	) {
		this.bots = new Array(amount)
			.fill(null)
			.map((_, i) => new GameBot(i, strategy, this.wsUrl));
	}

	async setup(): Promise<boolean> {
		try {
			await Promise.all(
				this.bots.map(async (bot) => {
					await bot.connect();
                    bot.join(this.room);
				}),
			);
            await new Promise((resolve) => setTimeout(resolve, 1000));
			return true;
		} catch (error) {
			console.error("Error setting up bots:", error);
			return false;
		}
	}

    update(): void {
        this.bots.forEach((bot) => bot.update());
    }

	async shutdown(): Promise<void> {
		this.bots.forEach((bot) => {
			bot.close();
		});
	}
}
