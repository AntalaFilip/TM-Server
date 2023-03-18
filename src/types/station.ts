import Collection from "@discordjs/collection";
import {
	Resource,
	ResourceOptions,
	StationManager,
	StationTrack,
	StationTrackLink,
	StationTrackLinkOptions,
	StationTrackOptions,
	TMError,
	User,
	UserLink,
} from "../internal";

type StationType = "STATION" | "STOP";

function checkStationTypeValidity(toCheck: unknown): toCheck is StationType {
	return toCheck === "STATION" || toCheck === "STOP";
}

interface StationOptions extends ResourceOptions<StationManager> {
	name: string;
	short: string;
	tracks?: StationTrack[];
	stationType: StationType;
}

interface StationLinkOptions extends ResourceOptions {
	stationId: string;
	trackLinks?: StationTrackLink[];
	dispatcher?: User;
}

class Station extends Resource<StationManager> {
	private _name: string;
	public get name() {
		return this._name;
	}
	private set name(name: string) {
		this._name = name;
		this.propertyChange(`name`, name);
	}

	private _short: string;
	public get short() {
		return this._short;
	}
	private set short(short: string) {
		this._short = short;
		this.propertyChange(`short`, short);
	}

	private _stationType: StationType;
	public get stationType() {
		return this._stationType;
	}
	private set stationType(type: StationType) {
		this._stationType = type;
		this.propertyChange(`stationType`, type);
	}

	public readonly tracks: Collection<string, StationTrack>;

	constructor(options: StationOptions) {
		super("station", options);

		this._name = options.name;
		this._short = options.short;
		this._stationType = options.stationType;

		this.tracks = new Collection(options.tracks?.map((v) => [v.id, v]));
	}

	async addTrack(resource: StationTrack | StationTrackOptions, actor?: User) {
		actor && User.checkPermission(actor, "manage stations");

		if (!(resource instanceof StationTrack)) {
			resource = new StationTrack(resource);
		}
		if (!(resource instanceof StationTrack)) return;

		if (this.tracks.has(resource.id))
			throw new Error(`This Track is already created and assigned!`);

		this.tracks.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	getTrack(id: string, err: true): StationTrack;
	getTrack(id: string): StationTrack | undefined;
	getTrack(id: string, err?: boolean): unknown {
		const t = this.tracks.get(id);
		if (!t && err) throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return t;
	}

	metadata(): StationOptions {
		return {
			name: this.name,
			short: this.short,
			managerId: this.managerId,
			sessionId: this.sessionId,
			id: this.id,
			stationType: this.stationType,
		};
	}

	publicMetadata() {
		return this.metadata();
	}

	// GraphQL metadata
	fullMetadata() {
		return {
			...this.metadata(),
			_self: this,
		};
	}

	modify(data: Record<string, unknown>, actor: User) {
		User.checkPermission(actor, "manage stations");
		let modified = false;

		// TODO: auditing

		if (typeof data.name === "string") {
			this.name = data.name;
			modified = true;
		}
		if (typeof data.short === "string") {
			this.short = data.short;
			modified = true;
		}
		if (checkStationTypeValidity(data.stationType)) {
			this.stationType = data.stationType;
			modified = true;
		}

		if (!modified) return false;

		return true;
	}

	/**
	 * Saves to Redis.
	 * @redis ID structure: `BASE:realms:REALMID:station:STATIONID(+:tracks)`
	 */
	async save() {
		// Add the base metadata
		await this.manager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		// Add the track metadata
		if (this.tracks.size > 0)
			await this.manager.db.redis.hset(
				this.manager.key(`${this.id}:tracks`),
				this.tracks
					.map((tr) => [tr.id, JSON.stringify(tr.metadata())])
					.flat()
			);

		return true;
	}
}

class StationLink extends Resource {
	public readonly stationId: string;
	public get station() {
		const s = this.session.client.stationManager.get(this.stationId);
		if (!s) throw new TMError(`EINTERNAL`);
		return s;
	}

	private _dispatcherId?: string;
	public get dispatcher() {
		if (!this._dispatcherId) return undefined;
		const d = this.session.userLinkManager.get(this._dispatcherId);
		if (!d) throw new TMError(`EINTERNAL`);
		return d;
	}
	private set dispatcher(disp: UserLink | undefined) {
		this._dispatcherId = disp?.id;
		const trueTimestamp = this.session.timeManager.trueMs;
		this.manager.db.redis.xadd(
			this.manager.key(`${this.id}:dispatchers`),
			"*",
			"id",
			disp?.id ?? "",
			"type",
			disp?.type ?? "",
			"time",
			trueTimestamp
		);
		this.propertyChange(`dispatcherId`, disp?.id);
	}

	public get trains() {
		return Array.from(
			this.session.trainManager.trains
				.filter((t) => t.location?.stationLink === this)
				.values()
		);
	}

	public readonly trackLinks: Collection<string, StationTrackLink>;

	constructor(options: StationLinkOptions) {
		super(`stationlink`, options);

		this.stationId = options.stationId;
		this.trackLinks = new Collection(
			options.trackLinks?.map((v) => [v.id, v])
		);
	}

	setDispatcher(newDisp: UserLink | undefined, actor: UserLink) {
		// Permission checks
		const assigningSelf = newDisp === actor;
		const unassigningSelf =
			newDisp === undefined && this.dispatcher === actor;
		const self = assigningSelf || unassigningSelf;

		if (self) User.checkPermission(actor.user, "assign self");
		else User.checkPermission(actor.user, "assign users");

		const already = newDisp?.dispatching;
		if (already)
			throw new TMError(
				`EALREADYDISPATCHING`,
				`User is already dispatching in another station!`,
				{ station: already.id }
			);

		if (newDisp === this.dispatcher) return;
		this.dispatcher = newDisp;

		return true;
	}

	async addTrackLink(
		resource: StationTrackLink | StationTrackLinkOptions,
		actor?: UserLink
	) {
		actor && User.checkPermission(actor.user, "manage stations");

		if (!(resource instanceof StationTrackLink)) {
			resource = new StationTrackLink(resource);
		}
		if (!(resource instanceof StationTrackLink)) return;

		if (this.trackLinks.has(resource.id))
			throw new Error(`This TrackLink is already created and assigned!`);

		this.trackLinks.set(resource.id, resource);
		await resource.save();
		return resource;
	}
	getTrackLink(id: string, error: true): StationTrackLink;
	getTrackLink(id: string, error?: boolean): StationTrackLink | undefined;
	getTrackLink(track: StationTrack, error: true): StationTrackLink;
	getTrackLink(
		track: StationTrack,
		error?: boolean
	): StationTrackLink | undefined;
	getTrackLink(obj: string | StationTrack, error?: boolean): unknown {
		const l =
			typeof obj === "string"
				? this.trackLinks.get(obj)
				: this.trackLinks.find((tl) => tl.track === obj);
		if (!l && error) throw new TMError(`EINVALIDINPUT`, `Invalid input!`);
		return l;
	}

	metadata(): StationLinkOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			sessionId: this.sessionId,
			stationId: this.stationId,
		};
	}
	publicMetadata() {
		return this.metadata();
	}
	fullMetadata() {
		return this.metadata();
	}

	modify(): boolean {
		return false;
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		if (this.trackLinks.size > 0)
			await this.manager.db.redis.hset(
				this.manager.key(`${this.id}:tracklinks`),
				this.trackLinks
					.map((tr) => [tr.id, JSON.stringify(tr.metadata())])
					.flat()
			);

		return true;
	}
}

export {
	Station,
	StationOptions,
	checkStationTypeValidity,
	StationLink,
	StationLinkOptions,
};
