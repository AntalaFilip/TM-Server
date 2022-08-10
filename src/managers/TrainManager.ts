import Collection from "@discordjs/collection";
import Realm from "../types/realm";
import TMError from "../types/tmerror";
import Train, { TrainOptions, TrainOptionsMetadata } from "../types/train";
import TrainSet from "../types/trainset";
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
				this.logger.debug(`Ready; loaded ${this.trains.size} trains`);
				res();
			});
		});
	}

	get(id: string): Train | undefined {
		return this.trains.get(id);
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.trains.map((t) => t.fullMetadata());
	}

	async fromResourceIdentifier(fullId: string): Promise<Train | undefined> {
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
		if (!(resource instanceof Train))
			throw new TMError(`EINTERNAL`, `Something went wrong`);

		if (this.trains.has(resource.id))
			throw new Error(`This Train is already created!`);

		this.trains.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	private async createAllFromStore() {
		await this.realm.stationManager.ready;
		await this.realm.movableManager.ready;
		await this.realm.trainSetManager.ready;

		const allTrains = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allTrains);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as TrainOptionsMetadata;
				const locStat =
					v.location &&
					this.realm.stationManager.get(v.location.stationId);
				const location =
					locStat && v.location
						? {
								station: locStat,
								track: v.location.trackId
									? locStat.tracks.get(v.location.trackId)
									: undefined,
						  }
						: undefined;

				const locomotive = v.locomotiveId
					? this.realm.movableManager.getLoco(v.locomotiveId)
					: undefined;

				const trainSets = v.trainSetIds
					?.map((s) => this.realm.trainSetManager.get(s))
					.filter((s) => s instanceof TrainSet) as TrainSet[] | undefined;

				if (trainSets?.length !== v.trainSetIds?.length)
					throw new TMError(
						`ETRBADTRAINSETID`,
						`Invalid TrainSet ID passed!`,
						{
							got: v.trainSetIds,
							found: trainSets?.map((t) => t.id),
						}
					);

				const opt = { ...v, location, locomotive, trainSets };
				await this.create(opt);
			} catch {
				this.logger.warn(`Malformed train data @ ${r[0]}`);
			}
		}
	}
}

export default TrainManager;
