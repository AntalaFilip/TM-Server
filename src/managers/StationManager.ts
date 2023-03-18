import Collection from "@discordjs/collection";
import {
	BaseManager,
	Manager,
	ResourceData,
	ResourceOptions,
	Session,
	SessionResourceManager,
	Station,
	StationLink,
	StationLinkOptions,
	StationOptions,
	StationTrack,
	StationTrackLink,
	StationTrackLinkOptions,
	StationTrackOptions,
	TMError,
	User,
	UserLink,
} from "../internal";

class StationManager
	extends BaseManager
	implements ResourceData<StationManager>
{
	public readonly stations: Collection<string, Station>;
	public readonly ready: Promise<void>;

	constructor(client: Manager) {
		super(`stations`, client.io, client);

		this.stations = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.stations.size} stations`
				);
				res();
			});
		});
	}

	get(id: string, error: true): Station;
	get(id: string): Station | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.stations.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.stations.map((s) => s.fullMetadata());
	}

	async create(
		resource: Station | StationOptions,
		actor?: User
	): Promise<Station> {
		actor && User.checkPermission(actor, "manage stations");

		if (!(resource instanceof Station)) {
			resource = new Station(resource);
		}

		if (this.stations.has(resource.id))
			throw new Error(`This Station is already created!`);

		this.stations.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	async fromResourceIdentifier(fullId: string): Promise<Station | undefined> {
		if (!(await this.db.redis.exists(fullId, `${fullId}:tracks`))) return;

		const stationMeta = (await this.db.get(fullId)) as StationOptions;
		const trackData = await this.db.redis.hgetall(`${fullId}:tracks`);
		const trackMeta = new Collection(Object.entries(trackData)).map(
			(meta) => JSON.parse(meta) as StationTrackOptions
		);
		stationMeta.tracks = trackMeta.map(
			(options) => new StationTrack(options)
		);

		return new Station(stationMeta);
	}

	private async createAllFromStore() {
		const allStations = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allStations);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as StationOptions;
				const trackData = await this.db.redis.hgetall(
					`${this.key(k)}:tracks`
				);
				const tracks = Object.entries(trackData)
					.map(([_k, v]) => JSON.parse(v) as StationTrackOptions)
					.map((meta) => new StationTrack(meta));
				v.tracks = tracks;

				await this.create(v);
			} catch (err) {
				this.logger.warn(`Malformed station data @ ${r[0]}`);
				if (err instanceof Error) this.logger.verbose(err.message);
			}
		}

		return true;
	}
}

class StationLinkManager extends SessionResourceManager {
	public readonly links: Collection<string, StationLink>;
	public readonly ready: Promise<void>;

	constructor(session: Session) {
		super(session, `stationlinks`);

		this.links = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.links.size} stationlinks`
				);
				res();
			});
		});
	}

	get(id: string, error: true): StationLink;
	get(id: string): StationLink | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.links.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}

	getByStation(station: Station, error: true): StationLink;
	getByStation(station: Station): StationLink | undefined;
	getByStation(station: Station, error?: boolean): unknown {
		const l = this.links.find((l) => l.station === station);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input Station!`);
		return l;
	}

	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll(): ResourceOptions<SessionResourceManager>[] {
		return this.links.map((sl) => sl.fullMetadata());
	}

	async create(
		resource: StationLink | StationLinkOptions,
		actor?: UserLink
	): Promise<StationLink> {
		actor &&
			User.checkPermission(actor.user, "manage stations", this.session);

		if (!(resource instanceof StationLink)) {
			resource = new StationLink(resource);
		}

		if (this.links.has(resource.id))
			throw new Error(`This StationLink is already created!`);

		this.links.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	async fromResourceIdentifier(
		fullId: string
	): Promise<StationLink | undefined> {
		if (!(await this.db.redis.exists(fullId, `${fullId}:tracklinks`)))
			return;

		const slMeta = (await this.db.get(fullId)) as StationLinkOptions;
		const tlData = await this.db.redis.hgetall(`${fullId}:tracklinks`);
		const tlMeta = new Collection(Object.entries(tlData)).map(
			(meta) => JSON.parse(meta) as StationTrackLinkOptions
		);
		slMeta.trackLinks = tlMeta.map(
			(options) => new StationTrackLink(options)
		);

		return new StationLink(slMeta);
	}

	private async createAllFromStore() {
		const allLinks = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allLinks);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as StationLinkOptions;
				const tlData = await this.db.redis.hgetall(
					`${this.key(k)}:tracklinks`
				);
				const trackLinks = Object.entries(tlData)
					.map(([_k, v]) => JSON.parse(v) as StationTrackLinkOptions)
					.map((meta) => new StationTrackLink(meta));
				v.trackLinks = trackLinks;

				const dispd = await this.db.redis.xrevrange(
					`${this.key(k)}:dispatchers`,
					"+",
					"-",
					"COUNT",
					1
				);
				const lastDisp = dispd[0];
				if (lastDisp && lastDisp[1]) {
					const id = lastDisp[1][1];
					const type = lastDisp[1][3];
					if (type === "user" && id) {
						const u = this.client.userManager.get(id);
						if (u) {
							v.dispatcher = u;
						}
					}
				}

				await this.create(v);
			} catch (err) {
				this.logger.warn(`Malformed stationlink data @ ${r[0]}`);
				if (err instanceof Error) this.logger.verbose(err.message);
			}
		}

		return true;
	}
}

export { StationManager, StationLinkManager };
