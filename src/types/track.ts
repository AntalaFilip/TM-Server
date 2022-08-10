import Resource, { ResourceOptions } from "./resource";
import Train from "./train";
import User from "./user";

interface StationTrackOptions extends ResourceOptions {
	stationId: string;
	name: string;
	short: string;
	length?: number;
	usedForParking: boolean;
}

class StationTrack extends Resource {
	public readonly stationId: string;
	/** The station the Track is located in */
	public get station() {
		return this.realm.stationManager.get(this.stationId);
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

	public get currentTrain(): Train | undefined {
		return this.realm.trainManager.trains.find(
			(t) => t.location?.track === this
		);
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
		if (!actor.hasPermission("manage stations", this.realm))
			throw new Error(`No permission`);
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
			realmId: this.realmId,
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

export default StationTrack;
export { StationTrackOptions };
