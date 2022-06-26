import Resource, { ResourceOptions } from "./resource";
import Timetable from "./timetable";
import TrainSet from "./trainset";

type ArrDepSet = {
	arrival: Date,
	departure: Date,
}

interface TimetableEntryOptions extends ResourceOptions {
	trainId: string,
	stationId: string,
	trackId: string,
	sets?: TrainSet[],
	locomotiveId: string,
	start: Date,
	repeats: number,
	duration: number,
	usedFrom?: Date,
	usedTill?: Date,
}

class TimetableEntry extends Resource {
	public readonly ttId: string;
	public get timetable(): Timetable { return this.realm.timetableManager.get(this.ttId) };

	private _trainId: string;
	public get trainId() { return this._trainId };
	private set trainId(id: string) {
		this._trainId = id;
		this.propertyChange(`trainId`, id);
	}
	public get train() { return this.realm.trainManager.get(this.trainId) };

	private _stationId: string;
	public get stationId() { return this._stationId };
	private set stationId(id: string) {
		this._stationId = id;
		this.propertyChange(`stationId`, id);
	}
	public get station() { return this.realm.stationManager.get(this.stationId) };

	private _trackId: string;
	public get trackId() { return this._trackId };
	private set trackId(id: string) {
		this._trackId = id;
		this.propertyChange(`trackId`, id);
	}
	public get track() { return this.station.tracks.get(this.trackId) };

	public readonly sets: TrainSet[];

	private _locomotiveId: string;
	public get locomotiveId() { return this._locomotiveId };
	private set locomotiveId(id: string) {
		this._locomotiveId = id;
		this.propertyChange(`locomotiveId`, id);
	}
	public get locomotive() { return this.realm.movableManager.getLoco(this.locomotiveId) };

	private _usedFrom: Date;
	public get usedFrom() { return this._usedFrom };
	private set usedFrom(date: Date) {
		this._usedFrom = date;
		this.propertyChange(`usedFrom`, date);
	}

	private _usedTill: Date;
	public get usedTill() { return this._usedTill };
	private set usedTill(date: Date) {
		this._usedTill = date;
		this.propertyChange(`usedTill`, date);
	}

	private _repeats: number;
	public get repeats() { return this._repeats };
	private set repeats(ms: number) {
		this._repeats = ms;
		this.propertyChange(`repeats`, ms);
	}

	private _start: Date;
	public get start() { return this._start };
	private set start(date: Date) {
		this.start = date;
		this.propertyChange(`start`, date);
	}

	private _duration: number;
	public get duration() { return this._duration };
	private set duration(length: number) {
		this._duration = length;
		this.propertyChange(`duration`, length);
	}

	public readonly times: ArrDepSet[];

	constructor(options: TimetableEntryOptions) {
		super(`timetableentry`, options);

		this._trainId = options.trainId;
		this._stationId = options.stationId;
		this._trackId = options.trackId;
		this._locomotiveId = options.locomotiveId;
		this._repeats = options.repeats;
		this._start = options.start;
		this._duration = options.duration;
		this._usedFrom = options.usedFrom;
		this._usedTill = options.usedTill;

		this.sets = options.sets ?? new Array();
		this.times = new Array();

		this.regenerate();
	}

	private regenerate() {
		this.times.length = 0;
		const count = this.timetable.genCount;
		const firstArr = this.findNextTime();
		// we want to generate the last entry as well, to make sure that current trains will have some reference
		for (let i = -1; i < (count - 1); i++) {
			const arrival = new Date(firstArr + (i * this.repeats));
			const departure = new Date(arrival.getTime() + this.duration);
			const set: ArrDepSet = {
				arrival,
				departure,
			};
			this.times.push(set);
		}

		return this.times.length;
	}

	private findNextTime(): number {
		const now = this.realm.timeManager.trueMs;
		// the time passed from the start
		const subt = now - this.start.getTime();
		// if the start is in the future, there is nothing more to calculate.
		if (subt < 0) return this.start.getTime();

		// no. of repeats until the next (Math.ceil) time
		// the last time would be Math.floor
		const repeats = Math.ceil(subt / this.repeats);
		// calculated next time
		return this.start.getTime() + (this.repeats * repeats);
	}

	genNewTime(shift = true) {
		if (shift) this.times.shift();

		const last = this.times[this.times.length - 1];
		const arrival = new Date(last.arrival.getTime() + this.repeats);
		const departure = new Date(arrival.getTime() + this.duration);

		const set: ArrDepSet = {
			arrival,
			departure,
		};
		return set;
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
		};
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.manager.key(`${this.timetable.id}:entries`), [this.id, JSON.stringify(this.metadata())]);

		return true;
	}
}

export default TimetableEntry;
export { TimetableEntryOptions, ArrDepSet };