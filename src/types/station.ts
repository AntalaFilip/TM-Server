import Resource, { ResourceOptions } from "./resource";
import StationTrack, { StationTrackOptions } from "./track";
import Collection from '@discordjs/collection';
import User from "./user";

type StationType = 'station' | 'stop';

function checkStationTypeValidity(toCheck: unknown): toCheck is StationType {
	return toCheck === 'station' || toCheck === 'stop';
}

interface StationOptions extends ResourceOptions {
	name: string,
	short: string,
	tracks?: StationTrack[],
	stationType: StationType,
	dispatcher?: User
}

class Station extends Resource {
	private _name: string;
	public get name() { return this._name; }
	private set name(name: string) {
		this._name = name;
		this.propertyChange(`name`, name);
	}

	private _short: string;
	public get short() { return this._short }
	private set short(short: string) {
		this._short = short;
		this.propertyChange(`short`, short);
	}

	private _stationType: StationType;
	public get stationType() { return this._stationType; }
	private set stationType(type: StationType) {
		this._stationType = type;
		this.propertyChange(`stationType`, type);
	}

	private _dispatcher: User;
	public get dispatcher() { return this._dispatcher; }
	private set dispatcher(disp: User) {
		this._dispatcher = disp;
		// TODO: stream
		this.propertyChange(`dispatcher`, disp);
	}

	public get trains() { return Array.from(this.realm.trainManager.trains.filter(t => t.location?.station === this).values()); }

	public readonly tracks: Collection<string, StationTrack>;

	constructor(options: StationOptions) {
		super('station', options);

		this._name = options.name;
		this._stationType = options.stationType;
		this._dispatcher = options.dispatcher;
		this.tracks = new Collection(options.tracks?.map(v => [v.id, v]));
	}

	async addTrack(resource: StationTrack | StationTrackOptions, actor?: User) {
		if (actor && !actor.hasPermission('manage stations', this.realm)) throw new Error('No permission!');

		if (!(resource instanceof StationTrack)) {
			resource = new StationTrack(resource);
		}
		if (!(resource instanceof StationTrack)) return;

		if (this.tracks.has(resource.id)) throw new Error(`This Track is already created and assigned!`);

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

	modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission('manage stations', this.realm)) throw new Error(`No permission`);
		let modified = false;

		// TODO: auditing

		if (typeof data.name === 'string') {
			this.name = data.name;
			modified = true;
		}
		if (typeof data.short === 'string') {
			this.short = data.short;
			modified = true;
		}
		if (checkStationTypeValidity(data.stationType)) {
			this.stationType = data.stationType;
			modified = true;
		}
		if (typeof data.dispatcherId === 'string' && this.realm.client.userManager.get(data.dispatcherId)) {
			this.dispatcher = this.realm.client.userManager.get(data.dispatcherId);
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
		await this.manager.db.add(this.id, this.metadata());

		// Add the track metadata
		if (this.tracks.size > 0) await this.manager.db.redis.hset(this.manager.key(`${this.id}:tracks`), this.tracks.map(tr => [tr.id, JSON.stringify(tr.metadata())]));

		return true;
	}
}

export default Station;
export { StationOptions, checkStationTypeValidity };