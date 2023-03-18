import Collection from "@discordjs/collection";
import {
	MovableLink,
	Session,
	SessionResourceManager,
	TMError,
	TrainSet,
	TrainSetOptions,
	TrainSetOptionsMetadata,
	User,
	UserLink,
} from "../internal";

class TrainSetManager extends SessionResourceManager {
	public readonly trainsets: Collection<string, TrainSet>;
	public readonly ready: Promise<void>;

	constructor(realm: Session) {
		super(realm, `trainsets`);

		this.trainsets = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(`Ready; ${this.trainsets.size} sets loaded`);
				res();
			});
		});
	}

	get(id: string, error: true): TrainSet;
	get(id: string): TrainSet | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.trainsets.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.trainsets.map((ts) => ts.fullMetadata());
	}

	async create(
		resource: TrainSet | TrainSetOptions,
		actor?: UserLink
	): Promise<TrainSet> {
		actor &&
			User.checkPermission(actor.user, "manage trains", this.session);

		if (!(resource instanceof TrainSet)) {
			resource = new TrainSet(resource);
		}
		if (!(resource instanceof TrainSet)) throw new TMError(`EINTERNAL`);

		if (this.trainsets.has(resource.id))
			throw new Error(`This TrainSet is already created!`);

		this.trainsets.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	async fromResourceIdentifier(id: string): Promise<TrainSet | undefined> {
		if (!(await this.db.redis.hexists(this.id, id))) return;

		const setData = await this.db.redis.hget(this.id, id);
		if (!setData) throw new TMError(`EDBERROR`);
		const setMeta = JSON.parse(setData) as TrainSetOptions;

		return new TrainSet(setMeta);
	}

	private async createAllFromStore() {
		await this.session.movableLinkManager.ready;
		const allSets = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allSets);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as TrainSetOptionsMetadata;
				const components = v.componentIds
					.map((c) => this.session.movableLinkManager.get(c))
					.filter((m) => m instanceof MovableLink) as MovableLink[];
				// TODO: self-healing
				if (components.length != v.componentIds.length)
					throw new TMError(
						`ETSBADCOMPONENTID`,
						"Invalid component ID passed!",
						{
							got: v.componentIds,
							found: components?.map((c) => c.id),
						}
					);
				const opt = {
					...v,
					components,
				};
				await this.create(opt);
			} catch (err) {
				this.logger.warn(`Malformed trainset data @ ${r[0]}`);
			}
		}

		return true;
	}
}

export { TrainSetManager };
