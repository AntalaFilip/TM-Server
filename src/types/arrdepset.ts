import {
	Action,
	msToMin,
	ResourceOptions,
	TMError,
	Train,
	TrainSet,
	User,
	UserLink,
} from "../internal";

interface ArrDepSetOptions extends ResourceOptions {
	id: string;
	timetableId?: string;
	entryId?: string;
	managerId: string;
	rpt?: number;

	scheduledArrival: Date;
	arrivalDelay: number;
	actualArrival?: Date;

	scheduledDeparture: Date;
	departureDelay: number;
	actualDeparture?: Date;

	cancelledReason?: string;

	trainId: string;
	stationLinkId: string;
	trackLinkId: string;
	locomotiveLinkId: string;
	setIds: string[];
}
class ArrDepSet extends Action<Train> {
	public readonly timetableId?: string;
	public get timetable() {
		if (!this.timetableId) return;
		return this.manager.session.timetableManager.get(this.timetableId);
	}
	public readonly entryId?: string;
	public get entry() {
		return this.timetable?.entries.find((e) => e.id === this.entryId);
	}
	public readonly rpt: number;

	public get scheduledArrival() {
		return this.from;
	}
	private set scheduledArrival(arr: Date) {
		this.from = arr;
		this.propertyChange("scheduledArrival", arr);
	}

	private _arrivalDelay: number;
	public get arrivalDelay() {
		return this._arrivalDelay;
	}
	private set arrivalDelay(delay: number) {
		this._arrivalDelay = delay;
		this.propertyChange("arrivalDelay", delay);
	}

	private _actualArrival?: Date;
	public get actualArrival() {
		return this._actualArrival;
	}
	private set actualArrival(arr: Date | undefined) {
		this._actualArrival = arr;
		this.propertyChange("actualArrival", arr);
	}

	public get scheduledDeparture() {
		return this.to;
	}
	private set scheduledDeparture(dep: Date) {
		this.to = dep;
		this.propertyChange("scheduledDeparture", dep);
	}

	private _departureDelay: number;
	public get departureDelay() {
		return this._departureDelay;
	}
	private set departureDelay(delay: number) {
		this._departureDelay = delay;
		this.propertyChange(`departureDelay`, delay);
	}

	private _actualDeparture?: Date;
	public get actualDeparture() {
		return this._actualDeparture;
	}
	private set actualDeparture(dep: Date | undefined) {
		this._actualDeparture = dep;
		this.propertyChange(`actualDeparture`, dep);
	}

	public get train() {
		return this.subject;
	}

	private _stationLinkId: string;
	public get stationLinkId() {
		return this._stationLinkId;
	}
	private set stationLinkId(id: string) {
		this._stationLinkId = id;
		this.propertyChange(`stationLinkId`, id);
	}
	/** The Station that the Train arrives to and departs from */
	public get stationLink() {
		const station = this.session.stationLinkManager.get(this.stationLinkId);
		if (!station) throw new TMError(`EINTERNAL`);
		return station;
	}
	private _trackLinkId: string;
	public get trackLinkId() {
		return this._trackLinkId;
	}
	private set trackLinkId(id: string) {
		this._trackLinkId = id;
		this.propertyChange(`trackLinkId`, id);
	}
	public get trackLink() {
		const t = this.stationLink.trackLinks.get(this.trackLinkId);
		if (!t) throw new TMError(`EINTERNAL`);
		return t;
	}

	public readonly setIds: string[];
	/** The TrainSets that the Train is supposed to leave with from the Station */
	public get sets() {
		return this.setIds
			.map((id) => this.manager.session.trainSetManager.get(id))
			.filter((t) => t instanceof TrainSet) as TrainSet[];
	}

	private _locomotiveLinkId: string;
	public get locomotiveLinkId() {
		return this._locomotiveLinkId;
	}
	private set locomotiveLinkId(id: string) {
		this._locomotiveLinkId = id;
		this.propertyChange(`locomotiveLinkId`, id);
	}
	public get locomotiveLink() {
		const l = this.session.movableLinkManager.getLocoLink(
			this.locomotiveLinkId
		);
		if (!l) throw new TMError(`EINTERNAL`);
		return l;
	}

	public readonly usable = true;

	constructor(options: ArrDepSetOptions) {
		super("arrdepset", {
			from: options.scheduledArrival,
			to: options.scheduledDeparture,
			id: options.id,
			managerId: options.managerId,
			sessionId: options.sessionId,
			subjectId: options.trainId,
			subjectType: "train",
			cancelledReason: options.cancelledReason,
		});
		this.timetableId = options.timetableId;
		this.entryId = options.entryId;
		this.rpt = options.rpt ?? 1;

		this._arrivalDelay = options.arrivalDelay ?? 0;
		this._actualArrival = options.actualArrival;
		this._departureDelay = options.departureDelay ?? 0;
		this._actualDeparture = options.actualDeparture;

		this._stationLinkId = options.stationLinkId;
		this._trackLinkId = options.trackLinkId;
		this.setIds = options.setIds ?? [];
		this._locomotiveLinkId = options.locomotiveLinkId;
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

	setDeparted(date = new Date(), actor?: UserLink) {
		actor &&
			User.checkPermission(actor.user, "manage timetables", this.session);

		this.actualDeparture = date;
		this.departureDelay = msToMin(
			this.actualDeparture.getTime() - this.scheduledArrival.getTime()
		);
	}
	setArrived(date = new Date(), actor?: UserLink) {
		actor &&
			User.checkPermission(actor.user, "manage timetables", this.session);

		this.actualArrival = date;
		this.arrivalDelay = msToMin(
			this.actualArrival.getTime() - this.scheduledArrival.getTime()
		);
	}
	delay(delay: number, type: "ARRIVAL" | "DEPARTURE", actor?: UserLink) {
		actor &&
			User.checkPermission(actor.user, "manage timetables", this.session);

		if (type === "ARRIVAL") {
			this.arrivalDelay = delay;
		} else if (type === "DEPARTURE") {
			this.departureDelay = delay;
		}
	}
	cancel(reason?: string, actor?: UserLink) {
		actor &&
			User.checkPermission(actor.user, "manage timetables", this.session);

		// TODO: auditing
		this.cancelledReason = reason || "Cancelled";
	}
	/**
	 * Returns an ADS following this one and generates one ADS at the end.
	 * @returns next ArrDepSet
	 */
	async nextADS(): Promise<ArrDepSet> {
		if (!this.entry)
			throw new TMError(`EADSNOTRECURRENT`, `This ADS is not recurrent!`);
		const all = Array.from(
			this.session.aDSManager.arrdepsets
				.filter((ads) => ads.entry === this.entry)
				.values()
		);
		all.sort((a, b) => a.rpt - b.rpt);
		const last = all[all.length - 1];
		await this.session.aDSManager.create(
			this.session.aDSManager.fromEntry(this.entry, last.rpt + 1)
		);
		const next = all.find((ads) => ads.rpt === this.rpt + 1);
		if (!next)
			throw new TMError(
				`EINTERNAL`,
				`Missing next ArrDepSet, is the database corrupted?`,
				{ currentADS: this.id, allADS: all.map((ads) => ads.id) }
			);

		return next;
	}

	modify(data: Record<string, unknown>, actor: UserLink) {
		User.checkPermission(actor.user, "manage timetables", this.session);
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
			this.stationLink.trackLinks.get(data.trackId)
		) {
			this.trackLinkId = data.trackId;
			modified = true;
		}

		return modified;
	}

	metadata(): ArrDepSetOptions {
		return {
			id: this.id,
			managerId: this.id,
			sessionId: this.sessionId,
			cancelledReason: this.cancelledReason,
			entryId: this.entryId,
			scheduledArrival: this.scheduledArrival,
			scheduledDeparture: this.scheduledDeparture,
			stationLinkId: this.stationLinkId,
			timetableId: this.timetableId,
			trackLinkId: this.trackLinkId,
			actualArrival: this.actualArrival,
			actualDeparture: this.actualDeparture,
			trainId: this.train.id,
			locomotiveLinkId: this.locomotiveLinkId,
			setIds: this.setIds,
			arrivalDelay: this.arrivalDelay,
			departureDelay: this.departureDelay,
			rpt: this.rpt,
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

export { ArrDepSet, ArrDepSetOptions };
