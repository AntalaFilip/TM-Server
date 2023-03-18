import {
	Resource,
	ResourceOptions,
	StationLink,
	StationManager,
	TMError,
	Train,
	User,
} from "../internal";

interface StationTrackOptions extends ResourceOptions<StationManager> {
	stationId: string;
	name: string;
	short: string;
	length?: number;
	usedForParking: boolean;
}

interface StationTrackLinkOptions extends ResourceOptions {
	trackId: string;
	stationLinkId: string;
}

class StationTrack extends Resource<StationManager> {
	public override readonly type = "track";
	public readonly stationId: string;
	/** The station the Track is located in */
	public get station() {
		return this.manager.client.stationManager.get(this.stationId);
	}

	private _name: string;
	public get name() {
		return this._name;
	}
	private set name(name: string) {
		this._name = name;
		this.propertyChange(`name`, this.name);
	}

	private _short: string;
	public get short() {
		return this._short;
	}
	private set short(short: string) {
		this._short = short;
		this.propertyChange(`short`, this.short);
	}

	private _length?: number;
	public get length() {
		return this._length;
	}
	private set length(length: number | undefined) {
		this._length = length;
		this.propertyChange("length", this.length);
	}

	private _usedForParking: boolean;
	public get usedForParking() {
		return this._usedForParking;
	}
	private set usedForParking(used: boolean) {
		this._usedForParking = used;
		this.propertyChange("usedForParking", this.usedForParking);
	}

	constructor(options: StationTrackOptions) {
		super("track", options);

		this.stationId = options.stationId;
		this._length = options.length;
		this._usedForParking = options.usedForParking;
		this._name = options.name;
		this._short = options.short ?? options.name;
	}

	modify(data: Record<string, unknown>, actor: User) {
		User.checkPermission(actor, "manage stations");
		let modified = false;

		// TODO: auditing

		if (typeof data.name === "string") {
			this.name = data.name;
			modified = true;
		}
		if (typeof data.length === "number") {
			this.length = data.length;
			modified = true;
		}
		if (typeof data.usedForParking === "boolean") {
			this.usedForParking = data.usedForParking;
			modified = true;
		}

		if (!modified) return false;

		return true;
	}

	metadata(): StationTrackOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			sessionId: this.sessionId,
			stationId: this.stationId,
			usedForParking: this.usedForParking,
			length: this.length,
			name: this.name,
			short: this.short,
		};
	}
	publicMetadata() {
		return {
			...this.metadata(),
		};
	}
	fullMetadata() {
		return {
			...this.metadata(),
			station: this.station?.publicMetadata(),
		};
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(`${this.stationId}:tracks`, [
			this.id,
			JSON.stringify(this.metadata()),
		]);
		return true;
	}
}

class StationTrackLink extends Resource {
	public override readonly type = "stationtracklink";
	public readonly trackId: string;
	public readonly stationLinkId: string;
	public get stationLink() {
		const s = this.manager.get(this.stationLinkId);
		if (!s) throw new TMError(`EINTERNAL`);
		return s as StationLink;
	}
	public get track() {
		const t = this.stationLink.station.tracks.find(
			(t) => t.id === this.trackId
		);
		if (!t) throw new TMError(`EINTERNAL`);
		return t;
	}

	public get currentTrain(): Train | undefined {
		return this.session.trainManager.trains.find(
			(t) => t.location?.trackLink === this
		);
	}

	constructor(options: StationTrackLinkOptions) {
		super(`stationtracklink`, options);

		this.trackId = options.trackId;
		this.stationLinkId = options.stationLinkId;
	}

	metadata(): StationTrackLinkOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			sessionId: this.sessionId,
			stationLinkId: this.stationLinkId,
			trackId: this.trackId,
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
		await this.manager.db.redis.hset(
			this.manager.key(`${this.stationLinkId}:tracklinks`),
			[this.id, JSON.stringify(this.metadata())]
		);
		return true;
	}
}

export {
	StationTrack,
	StationTrackOptions,
	StationTrackLink,
	StationTrackLinkOptions,
};
