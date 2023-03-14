import Collection from "@discordjs/collection";
import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import { SessionSpecificDataManager } from "../managers/SessionSpecificDataManager";
import ArrDepSet from "./ArrDepSet";
import Resource, { ResourceOptions } from "./Resource";
import { SessionSpecificResourceData } from "./SessionSpecificResourceData";
import Timetable from "./Timetable";
import TMError from "./TMError";
import TrainSet from "./TrainSet";

interface TimetableEntryOptions extends ResourceOptions {
	trainId: string;
	stationId: string;
	trackId: string;
	setIds?: string[];
	locomotiveId: string;
	start: Date;
	repeats: number;
	duration: number;
	usedFrom: Date;
	usedTill?: Date;
	current?: ArrDepSet;
	adsCount?: number;
	cancelledAds?: number[];
	delayedAds?: [number, number][];
	ttId: string;
}

class SessionSpecificTimetableEntryData extends SessionSpecificResourceData<TimetableEntry> {
	public sessionData: undefined;
	metadata(): SessionSpecificResourceDataOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			realmId: this.realmId,
			sessionId: this.sessionId,
		};
	}

	constructor(
		options: SessionSpecificResourceDataOptions,
		resource: TimetableEntry
	) {
		super(`sessionspecific-timetable`, options, resource);
	}

	fullMetadata() {
		return this.metadata();
	}

	publicMetadata() {
		return this.metadata();
	}

	modify() {
		return false;
	}

	async save() {
		this.instanceManager.db.redis.hset(this.instanceManager.id, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}

class SessionSpecificTimetableEntryDataManager extends SessionSpecificDataManager<TimetableEntry> {
	instantiate(
		opts: SessionSpecificResourceDataOptions,
		resource: TimetableEntry
	): SessionSpecificTimetableEntryData {
		return new SessionSpecificTimetableEntryData(opts, resource);
	}
}

class TimetableEntry extends Resource {
	public sessionData: SessionSpecificTimetableEntryDataManager;
	public readonly ttId: string;
	public get timetable(): Timetable {
		const tt = this.realm.timetableManager.get(this.ttId);
		if (!tt) throw new TMError(`EINTERNAL`);
		return tt;
	}

	private _trainId: string;
	public get trainId() {
		return this._trainId;
	}
	private set trainId(id: string) {
		this._trainId = id;
		this.propertyChange(`trainId`, id);
	}
	public get train() {
		const t = this.realm.trainManager.get(this.trainId);
		if (!t) throw new TMError(`EINTERNAL`);
		return t;
	}

	private _stationId: string;
	public get stationId() {
		return this._stationId;
	}
	private set stationId(id: string) {
		this._stationId = id;
		this.propertyChange(`stationId`, id);
	}
	public get station() {
		const s = this.realm.stationManager.get(this.stationId);
		if (!s) throw new TMError(`EINTERNAL`);
		return s;
	}

	private _trackId: string;
	public get trackId() {
		return this._trackId;
	}
	private set trackId(id: string) {
		this._trackId = id;
		this.propertyChange(`trackId`, id);
	}
	public get track() {
		const t = this.station.tracks.get(this.trackId);
		if (!t) throw new TMError(`EINTERNAL`);
		return t;
	}

	public readonly setIds: string[];
	public get sets() {
		return this.setIds
			.map((id) => this.realm.trainSetManager.get(id))
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
		const l = this.realm.movableManager.getLoco(this.locomotiveId);
		if (!l) throw new TMError(`EINTERNAL`);
		return l;
	}

	private _usedFrom: Date;
	public get usedFrom() {
		return this._usedFrom;
	}
	private set usedFrom(date: Date) {
		this._usedFrom = date;
		this.propertyChange(`usedFrom`, date);
	}

	private _usedTill?: Date;
	public get usedTill() {
		return this._usedTill;
	}
	private set usedTill(date: Date | undefined) {
		this._usedTill = date;
		this.propertyChange(`usedTill`, date);
	}

	private _repeats: number;
	public get repeats() {
		return this._repeats;
	}
	private set repeats(ms: number) {
		this._repeats = ms;
		this.propertyChange(`repeats`, ms);
	}

	private _start: Date;
	public get start() {
		return this._start;
	}
	private set start(date: Date) {
		this.start = date;
		this.propertyChange(`start`, date);
	}

	private _duration: number;
	public get duration() {
		return this._duration;
	}
	private set duration(length: number) {
		this._duration = length;
		this.propertyChange(`duration`, length);
	}

	private _adsCount: number;
	public get adsCount() {
		return this._adsCount;
	}
	private set adsCount(count: number) {
		if (count <= this._adsCount) return;
		this._adsCount = count;
		this.propertyChange(`adsCount`, count);
	}

	public readonly cancelledAds: number[];
	public readonly delayedAds: Collection<number, number>;

	constructor(options: TimetableEntryOptions) {
		super(`timetableentry`, options);

		this.ttId = options.ttId;
		this._trainId = options.trainId;
		this._stationId = options.stationId;
		this._trackId = options.trackId;
		this._locomotiveId = options.locomotiveId;
		this._repeats = options.repeats;
		this._start = options.start;
		this._duration = options.duration;
		this._usedFrom = options.usedFrom;
		this._usedTill = options.usedTill;
		this._adsCount = options.adsCount ?? 0;
		this.cancelledAds = options.cancelledAds ?? [];
		this.delayedAds = new Collection(options.delayedAds ?? []);

		this.setIds = options.setIds ?? [];

		this.sessionData = new SessionSpecificTimetableEntryDataManager(this.realm, this);
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

	modify(): boolean | Promise<boolean> {
		return false;
	}

	metadata(): TimetableEntryOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			realmId: this.realmId,
			duration: this.duration,
			locomotiveId: this.locomotiveId,
			repeats: this.repeats,
			start: this.start,
			stationId: this.stationId,
			trackId: this.trackId,
			trainId: this.trainId,
			usedFrom: this.usedFrom,
			usedTill: this.usedTill,
			setIds: this.sets.map((s) => s.id),
			adsCount: this.adsCount,
			delayedAds: Array.from(this.delayedAds.entries()),
			cancelledAds: this.cancelledAds,
			ttId: this.ttId,
		};
	}

	publicMetadata() {
		return this.metadata();
	}

	fullMetadata() {
		return {
			...this.metadata(),
			locomotive: this.locomotive?.publicMetadata(),
			station: this.station?.publicMetadata(),
			track: this.track?.publicMetadata(),
			train: this.train?.publicMetadata(),
			sets: this.sets.map((s) => s.publicMetadata()),
		};
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(
			this.manager.key(`${this.timetable.id}:entries`),
			[this.id, JSON.stringify(this.metadata())]
		);

		return true;
	}
}

export default TimetableEntry;
export { TimetableEntryOptions, ArrDepSet, SessionSpecificTimetableEntryData };
