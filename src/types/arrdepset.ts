import ADSManager from "../managers/ADSManager";
import Resource, { ResourceOptions } from "./Resource";
import TMError from "./TMError";
import TrainSet from "./TrainSet";
import User from "./User";

interface ArrDepSetOptions extends ResourceOptions<ADSManager> {
	id: string;
	timetableId: string;
	entryId?: string;
	managerId: string;

	scheduledArrival: Date;
	// arrivalDelay: number;
	actualArrival?: Date;

	scheduledDeparture: Date;
	// departureDelay: number;
	actualDeparture?: Date;

	cancelled: boolean;

	trainId: string;
	stationId: string;
	trackId: string;
	locomotiveId: string;
	setIds: string[];
}
class ArrDepSet extends Resource<ADSManager> {
	public sessionData: undefined;
	public readonly timetableId: string;
	public get timetable() {
		const tt = this.manager.realm.timetableManager.get(this.timetableId);
		if (!tt) throw new TMError(`EINTERNAL`);
		return tt;
	}
	public readonly entryId?: string;
	public get entry() {
		return this.timetable.entries.find((e) => e.id === this.entryId);
	}

	public scheduledArrival: Date;
	// public arrivalDelay: number;
	public actualArrival?: Date;

	public scheduledDeparture: Date;
	// public departureDelay: number;
	public actualDeparture?: Date;

	public cancelled: boolean;

	private _trainId: string;
	public get trainId() {
		return this._trainId;
	}
	private set trainId(id: string) {
		this._trainId = id;
		this.propertyChange(`trainId`, id);
	}
	public get train() {
		const t = this.manager.realm.trainManager.get(this.trainId);
		if (!t) throw new TMError(`EINTERNAL`);
		return t;
	}

	private _stationId: string;
	public get stationId() {
		return this._stationId;
	}
	private set stationId(id: string) {
		this._stationId = id;
		// this.propertyChange(`stationId`, id);
	}
	public get station() {
		const station = this.manager.realm.stationManager.get(this.stationId);
		if (!station) throw new TMError(`EINTERNAL`);
		return station;
	}
	private _trackId: string;
	public get trackId() {
		return this._trackId;
	}
	private set trackId(id: string) {
		this._trackId = id;
		// this.propertyChange(`trackId`, id);
	}
	public get track() {
		const t = this.station.tracks.get(this.trackId);
		if (!t) throw new TMError(`EINTERNAL`);
		return t;
	}

	public readonly setIds: string[];
	public get sets() {
		return this.setIds
			.map((id) => this.manager.realm.trainSetManager.get(id))
			.filter((t) => t instanceof TrainSet) as TrainSet[];
	}

	private _locomotiveId: string;
	public get locomotiveId() {
		return this._locomotiveId;
	}
	private set locomotiveId(id: string) {
		this._locomotiveId = id;
		this.propertyChange(`locomotiveId`, id);
	}
	public get locomotive() {
		const l = this.manager.realm.movableManager.getLoco(this.locomotiveId);
		if (!l) throw new TMError(`EINTERNAL`);
		return l;
	}

	public get nextSet() {
		// TODO: this seems too complex for what it does;
		// perhaps reimplement in ADSManager?
		return this.manager.arrdepsets
			.filter(
				(s) =>
					// must be larger or equal than, due to the possibility of specifying departure
					// from station 1 at the same time as arrival at station 2.
					s.scheduledArrival.getTime() >=
					this.scheduledDeparture.getTime()
			)
			.sort(
				(a, b) =>
					a.scheduledArrival.getTime() - b.scheduledArrival.getTime()
			)
			.first();
	}

	constructor(options: ArrDepSetOptions) {
		super("arrdepset", options);
		this.timetableId = options.timetableId;
		this.entryId = options.entryId;

		this.scheduledArrival = options.scheduledArrival;
		// this.arrivalDelay = options.arrivalDelay;
		this.actualArrival = options.actualArrival;
		this.scheduledDeparture = options.scheduledDeparture;
		// this.departureDelay = options.departureDelay;
		this.actualDeparture = options.actualDeparture;

		this.cancelled = options.cancelled;

		this._trainId = options.trainId;
		this._stationId = options.stationId;
		this._trackId = options.trackId;
		this.setIds = options.setIds ?? [];
		this._locomotiveId = options.locomotiveId;
	}

	/**
	 * Clears current and pushes new TrainSet IDs
	 * @param setIds an array of IDs of the new sets
	 */
	newSets(setIds: string[]) {
		this.setIds.length = 0;
		this.setIds.push(...setIds);
		this.propertyChange(`setIds`, setIds);
	}

	modify(data: Record<string, unknown>, actor: User) {
		User.checkPermission(actor, "manage timetables", this.manager.realm);
		let modified = false;

		if (typeof data.scheduledArrival === "number") {
			this.scheduledArrival = new Date(data.scheduledArrival);
			modified = true;
		}
		if (typeof data.scheduledDeparture === "number") {
			this.scheduledDeparture = new Date(data.scheduledDeparture);
			modified = true;
		}
		if (
			typeof data.trackId === "string" &&
			this.station.tracks.get(data.trackId)
		) {
			this.trackId = data.trackId;
			modified = true;
		}

		return modified;
	}

	metadata(): ArrDepSetOptions {
		return {
			id: this.id,
			managerId: this.id,
			realmId: this.realmId,
			cancelled: this.cancelled,
			entryId: this.entryId,
			scheduledArrival: this.scheduledArrival,
			scheduledDeparture: this.scheduledDeparture,
			stationId: this.stationId,
			timetableId: this.timetableId,
			trackId: this.trackId,
			actualArrival: this.actualArrival,
			actualDeparture: this.actualDeparture,
			trainId: this.trainId,
			locomotiveId: this.locomotiveId,
			setIds: this.setIds,
		};
	}

	publicMetadata() {
		return this.metadata();
	}
	fullMetadata() {
		return this.metadata();
	}

	async save() {
		await this.manager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}

export default ArrDepSet;
export { ArrDepSetOptions };
