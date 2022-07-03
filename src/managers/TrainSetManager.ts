import Collection from "@discordjs/collection";
import Realm from "../types/realm";
import TrainSet, { TrainSetOptions } from "../types/trainset";
import User from "../types/user";
import ResourceManager from "./ResourceManager";

class TrainSetManager extends ResourceManager {
	public readonly trainsets: Collection<string, TrainSet>;
	public readonly ready: Promise<void>;

	constructor(realm: Realm) {
		super(realm, `trainsets`);

		this.trainsets = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore()
				.then(() => {
					console.log(`TrainSetManager (${this.id}) ready; ${this.trainsets.size} sets loaded`);
					res();
				});
		});
	}

	get(id: string): TrainSet {
		return this.trainsets.get(id);
	}

	async create(resource: TrainSet | TrainSetOptions, actor?: User): Promise<TrainSet> {
		if (actor && !actor.hasPermission('manage stations', this.realm)) throw new Error('No permission!');

		if (!(resource instanceof TrainSet)) {
			resource = new TrainSet(resource);
		}
		if (!(resource instanceof TrainSet)) return;

		if (this.trainsets.has(resource.id)) throw new Error(`This TrainSet is already created!`);

		this.trainsets.set(resource.id, resource);
		await resource.save();
		return resource;
	}


	async fromResourceIdentifier(id: string): Promise<TrainSet> {
		if (!await this.db.redis.hexists(this.id, id)) return;

		const setData = await this.db.redis.hget(this.id, id);
		const setMeta = JSON.parse(setData) as TrainSetOptions;

		return new TrainSet(setMeta);
	}

	private async createAllFromStore() {
		const allSets = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allSets);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as TrainSetOptions;
				await this.create(v);
			}
			catch {
				console.warn(`Malformed trainset data @ ${r[0]}`);
			}
		}

		return true;
	}
}

export default TrainSetManager;