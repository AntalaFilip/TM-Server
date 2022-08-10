import Resource, { ResourceOptions } from "./resource";
import StationTrack, { StationTrackOptions } from "./track";
import Collection from "@discordjs/collection";
import User from "./user";
import { ForbiddenError } from "apollo-server-core";

type StationType = "STATION" | "STOP";

function checkStationTypeValidity(toCheck: unknown): toCheck is StationType {
	return toCheck === "STATION" || toCheck === "STOP";
}

interface StationOptions extends ResourceOptions {
	name: string;
	short: string;
	tracks?: StationTrack[];
	stationType: StationType;
	dispatcher?: User;
}

class Station extends Resource {
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

	private _dispatcher?: User;
	public get dispatcher() {
		return this._dispatcher;
	}
	private set dispatcher(disp: User | undefined) {
		this._dispatcher = disp;
		const trueTimestamp = this.realm.timeManager.trueMs;
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
		this.propertyChange(`dispatcher`, disp);
	}

	public get trains() {
		return Array.from(
			this.realm.trainManager.trains
				.filter((t) => t.location?.station === this)
				.values()
		);
	}

	public readonly tracks: Collection<string, StationTrack>;

	constructor(options: StationOptions) {
		super("station", options);

		this._name = options.name;
		this._short = options.short;
		this._stationType = options.stationType;

		// TODO: sanity check
		this._dispatcher = options.dispatcher;
		this.tracks = new Collection(options.tracks?.map((v) => [v.id, v]));
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
			dispatcherId: this.dispatcher?.id,
			trackIds: this.tracks.map((t) => t.id),
			trainIds: this.trains.map((t) => t.id),
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
		if (!actor.hasPermission("manage stations", this.realm))
			throw new ForbiddenError(`No permission`, {
				permission: `manage stations`,
			});
		let modified = false;

		// TODO: auditing

		if (
			typeof data.dispatcherId === "string" &&
			this.realm.client.userManager.get(data.dispatcherId)
		) {
			this.setDispatcher(
				this.realm.client.userManager.get(data.dispatcherId),
				actor
			);
			modified = true;
		}
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

	setDispatcher(disp: User | undefined, actor: User) {
		const self = actor.hasPermission("assign self");
		const others = actor.hasPermission("assign users");
		if (
			((disp === actor ||
				(disp == undefined && this.dispatcher === actor)) &&
				!self &&
				!others) ||
			!others
		)
			throw new ForbiddenError(`No permission`, {
				permission: "assign self XOR assign users",
			});

		if (disp === this.dispatcher) return;
		this.dispatcher = disp;

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

export default Station;
export { StationOptions, checkStationTypeValidity };
