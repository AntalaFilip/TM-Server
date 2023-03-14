import Collection from "@discordjs/collection";
import { ForbiddenError } from "apollo-server-core";
import Resource, { ResourceOptions } from "./Resource";
import { SessionSpecificStationDataManager } from "./SessionSpecificStationDataManager";
import StationTrack, { StationTrackOptions } from "./Track";
import User from "./User";

type StationType = "STATION" | "STOP";

function checkStationTypeValidity(toCheck: unknown): toCheck is StationType {
	return toCheck === "STATION" || toCheck === "STOP";
}

interface StationOptions extends ResourceOptions {
	name: string;
	short: string;
	tracks?: StationTrack[];
	stationType: StationType;
}

export class Station extends Resource {
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

	public sessionData: SessionSpecificStationDataManager;

	constructor(options: StationOptions) {
		super("station", options);

		this._name = options.name;
		this._short = options.short;
		this._stationType = options.stationType;

		// TODO: sanity check
		this.tracks = new Collection(options.tracks?.map((v) => [v.id, v]));
		this.sessionData = new SessionSpecificStationDataManager(
			this.realm,
			this
		);
	}

	async addTrack(resource: StationTrack | StationTrackOptions, actor?: User) {
		if (actor && !actor.hasPermission("manage stations", this.realm))
			throw new ForbiddenError("No permission!", {
				tmCode: `ENOPERM`,
				permission: `manage stations`,
			});

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

	metadata(): StationOptions {
		return {
			name: this.name,
			short: this.short,
			managerId: this.managerId,
			realmId: this.realmId,
			id: this.id,
			stationType: this.stationType,
		};
	}

	publicMetadata() {
		return {
			...this.metadata(),
			trackIds: this.tracks.map((t) => t.id),
		};
	}

	// GraphQL metadata
	fullMetadata() {
		return {
			...this.metadata(),
			id: this.id,
			_self: this,
		};
	}

	modify(data: Record<string, unknown>, actor: User) {
		User.checkPermission(actor, "manage stations", this.realm);
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

		return modified;
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

export default Station;
export { StationOptions, checkStationTypeValidity };
