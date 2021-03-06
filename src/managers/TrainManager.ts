import Collection from "@discordjs/collection";
import Realm from "../types/realm";
import Train, { TrainOptions } from "../types/train";
import User from "../types/user";
import ResourceManager from "./ResourceManager";

class TrainManager extends ResourceManager {
	public readonly trains: Collection<string, Train>;
	public readonly ready: Promise<void>;

	constructor(realm: Realm) {
		super(realm, `trains`);

		this.trains = new Collection();
		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.trains.size} trains`
				);
				res();
			});
		});
	}

	get(id: string): Train {
		return this.trains.get(id);
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.trains.map((t) => t.fullMetadata());
	}

	async fromResourceIdentifier(fullId: string): Promise<Train> {
		if (!(await this.db.redis.exists(fullId))) return;

		const trainMeta = (await this.db.get(fullId)) as TrainOptions;

		return new Train(trainMeta);
	}

	async create(resource: Train | TrainOptions, actor?: User): Promise<Train> {
		if (actor && !actor.hasPermission("manage trains", this.realm))
			throw new Error("No permission!");

		if (!(resource instanceof Train)) {
			resource = new Train(resource);
		}
		if (!(resource instanceof Train)) return;

		if (this.trains.has(resource.id))
			throw new Error(`This Train is already created!`);

		this.trains.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	private async createAllFromStore() {
		const prefix = process.env.REDIS_PREFIX;
		const allTrainIds = (
			await this.db.redis.keys(`${prefix}${this.id}:*[a-Z^:]`)
		).map((k) => k.slice(prefix.length));
		if (!allTrainIds || allTrainIds.length === 0) return;

		const allTrains = await this.db.redis.mget(allTrainIds);
		const arr = allTrainIds.map((v, i) => [v, allTrains[i]]);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as TrainOptions;
				await this.create(v);
			} catch {
				this.logger.warn(`Malformed train data @ ${r[0]}`);
			}
		}
	}
}

export default TrainManager;
