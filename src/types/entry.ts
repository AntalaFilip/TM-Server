import {
	Resource,
	ResourceOptions,
	Timetable,
	TMError,
	TrainSet,
} from "../internal";

interface TimetableEntryOptions extends ResourceOptions {
	trainId: string;
	stationLinkId: string;
	trackLinkId: string;
	setIds?: string[];
	locomotiveLinkId: string;
	start: Date;
	repeats: number;
	duration: number;
	usedFrom: Date;
	usedTill?: Date;
	ttId: string;
}

class TimetableEntry extends Resource {
	public readonly ttId: string;
	public get timetable(): Timetable {
		const tt = this.session.timetableManager.get(this.ttId);
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
		const t = this.session.trainManager.get(this.trainId);
		if (!t) throw new TMError(`EINTERNAL`);
		return t;
	}

	private _stationLinkId: string;
	public get stationLinkId() {
		return this._stationLinkId;
	}
	private set stationLinkId(id: string) {
		this._stationLinkId = id;
		this.propertyChange(`stationId`, id);
	}
	public get stationLink() {
		const s = this.session.stationLinkManager.get(this.stationLinkId);
		if (!s) throw new TMError(`EINTERNAL`);
		return s;
	}

	private _trackLinkId: string;
	public get trackLinkId() {
		return this._trackLinkId;
	}
	private set trackLinkId(id: string) {
		this._trackLinkId = id;
		this.propertyChange(`trackId`, id);
	}
	public get trackLink() {
		const t = this.stationLink.trackLinks.get(this.trackLinkId);
		if (!t) throw new TMError(`EINTERNAL`);
		return t;
	}

	public readonly setIds: string[];
	public get sets() {
		return this.setIds
			.map((id) => this.session.trainSetManager.get(id))
			.filter((t) => t instanceof TrainSet) as TrainSet[];
	}

	private _locomotiveLinkId: string;
	public get locomotiveLinkId() {
		return this._locomotiveLinkId;
	}
	private set locomotiveLinkId(id: string) {
		this._locomotiveLinkId = id;
		this.propertyChange(`locomotiveId`, id);
	}
	public get locomotiveLink() {
		const l = this.session.client.movableManager.getLoco(
			this.locomotiveLinkId
		);
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
	/** Interval in ms in which the entry repeats
	 * @unit millisecond
	 */
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
	/** Length of stay in the station in seconds
	 * @unit second
	 */
	private set duration(length: number) {
		this._duration = length;
		this.propertyChange(`duration`, length);
	}

	public get linkedADS() {
		return Array.from(
			this.session.aDSManager.arrdepsets
				.filter((ads) => ads.entry === this)
				.values()
		);
	}

	constructor(options: TimetableEntryOptions) {
		super(`timetableentry`, options);

		this.ttId = options.ttId;
		this._trainId = options.trainId;
		this._stationLinkId = options.stationLinkId;
		this._trackLinkId = options.trackLinkId;
		this._locomotiveLinkId = options.locomotiveLinkId;
		this._repeats = options.repeats;
		this._start = options.start;
		this._duration = options.duration;
		this._usedFrom = options.usedFrom;
		this._usedTill = options.usedTill;

		this.setIds = options.setIds ?? [];
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
			sessionId: this.sessionId,
			duration: this.duration,
			locomotiveLinkId: this.locomotiveLinkId,
			repeats: this.repeats,
			start: this.start,
			stationLinkId: this.stationLinkId,
			trackLinkId: this.trackLinkId,
			trainId: this.trainId,
			usedFrom: this.usedFrom,
			usedTill: this.usedTill,
			setIds: this.sets.map((s) => s.id),
			ttId: this.ttId,
		};
	}

	publicMetadata() {
		return this.metadata();
	}

	fullMetadata() {
		return this.metadata();
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(
			this.manager.key(`${this.timetable.id}:entries`),
			[this.id, JSON.stringify(this.metadata())]
		);

		return true;
	}
}

export { TimetableEntry, TimetableEntryOptions };
