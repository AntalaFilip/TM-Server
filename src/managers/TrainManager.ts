import Collection from "@discordjs/collection";
import {
	Session,
	SessionResourceManager,
	TMError,
	Train,
	TrainOptions,
	TrainOptionsMetadata,
	TrainSet,
	User,
	UserLink,
} from "../internal";

class TrainManager extends SessionResourceManager {
	public readonly trains: Collection<string, Train>;
	public readonly ready: Promise<void>;

	constructor(realm: Session) {
		super(realm, `trains`);

		this.trains = new Collection();
		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(`Ready; loaded ${this.trains.size} trains`);
				res();
			});
		});
	}

	get(id: string, error: true): Train;
	get(id: string): Train | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.trains.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
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

	async create(
		resource: Train | TrainOptions,
		actor?: UserLink
	): Promise<Train> {
		actor && User.checkPermission(actor.user, "manage trains");

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
		await this.session.stationLinkManager.ready;
		await this.session.movableLinkManager.ready;
		await this.session.trainSetManager.ready;

		const allTrains = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allTrains);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as TrainOptionsMetadata;
				const locStat =
					v.location &&
					this.session.stationLinkManager.get(
						v.location.stationLinkId
					);
				const location =
					locStat && v.location
						? {
								stationLink: locStat,
								trackLink: v.location.trackLinkId
									? locStat.trackLinks.get(
											v.location.trackLinkId
									  )
									: undefined,
						  }
						: undefined;

				const locomotive = v.locomotiveLinkId
					? this.session.movableLinkManager.getLocoLink(
							v.locomotiveLinkId
					  )
					: undefined;

				const trainSets = v.trainSetIds
					?.map((s) => this.session.trainSetManager.get(s))
					.filter((s) => s instanceof TrainSet) as
					| TrainSet[]
					| undefined;

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

export { TrainManager };
