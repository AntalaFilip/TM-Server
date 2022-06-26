import Locomotive from "./locomotive";
import { MovableLocation } from "./movable";
import Resource, { ResourceOptions } from "./resource";
import TrainSet from "./trainset";

interface TrainOptions extends ResourceOptions {
	name: string,
	short: string,
	locomotive?: Locomotive,
	trainSets?: TrainSet[],
	location?: MovableLocation,
	state?: TrainState,
	currentEntryId: string,
}

type TrainState = 'MISSING' | 'MOVING' | 'ARRIVED' | 'READY' | 'LEAVING';

class Train extends Resource {
	public readonly trainSets: TrainSet[];

	private _name: string;
	public get name() { return this._name; }
	private set name(name: string) { this._name = name; }

	private _short: string;
	public get short() { return this._short; }
	private set short(short: string) { this._short = short; }

	private _locomotive: Locomotive;
	public get locomotive() { return this._locomotive; }
	private set locomotive(loco: Locomotive) {
		this._locomotive = this.locomotive;
		const trueTimestamp = this.realm.timeManager.trueMs;
		// TODO: what about paused time?
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:locomotives`), "id", loco?.id, "type", loco?.type, "time", trueTimestamp);
		this.propertyChange(`locomotive`, loco);
	}

	private _location: MovableLocation;
	public get location() { return this._location; }
	private set location(newloc: MovableLocation) {
		this._location = newloc;
		// TODO: paused time?
		const trueTimestamp = this.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:locations`), "id", newloc?.id, "type", newloc?.type, "time", trueTimestamp);
		this.propertyChange(`location`, newloc, true);
	}

	private _state: TrainState;
	public get state() { return this._state; }
	private set state(newState: TrainState) {
		this._state = newState;
		const trueTimestamp = this.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:states`), "data", newState, "type", 'trainState', "time", trueTimestamp);
		this.propertyChange(`state`, newState, true);
	}

	public get allEntries() { return Array.from(this.realm.activeTimetable.entries.filter(e => e.train === this).values()).sort((a, b) => a.start.getTime() - b.start.getTime()); }

	private _currentEntryId: string;
	public get currentEntryId() { return this._currentEntryId; }
	private set currentEntryId(id: string) {
		this._currentEntryId = id;
		const trueTimestamp = this.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:entries`), "id", id, "type", "timetableentry", "time", trueTimestamp);
		this.propertyChange(`currentEntryId`, id, true);
	}
	public get currentEntry() { return this.allEntries?.find(e => e.id === this.currentEntryId); }

	constructor(options: TrainOptions) {
		super('train', options);

		this._name = options.name;
		this._short = options.short;

		this._locomotive = options.locomotive;
		this.trainSets = options.trainSets ?? [];
		this._state = options.state ?? `MISSING`;
		this._location = options.location;
	}

	nextEntry() {
		return this.allEntries[this.allEntries.indexOf(this.currentEntry) + 1] ?? this.allEntries[0];
	}

	async newTrainSets(sets: TrainSet[]) {
		this.trainSets.length = 0;
		this.trainSets.push(...sets);
		const trueTimestamp = this.manager.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:trainsets`), "ids", JSON.stringify(sets.map(s => s.id)), "time", trueTimestamp);
		this.propertyChange(`trainSets`, sets, true);
	}

	metadata(): TrainOptions {
		return {
			managerId: this.managerId,
			realmId: this.realmId,
			name: this.name,
			short: this.short,
			id: this.id,
			currentEntryId: this.currentEntryId,
		};
	}

	async save(): Promise<boolean> {
		await this.manager.db.add(this.id, this.metadata());

		return true;
	}
}

export default Train;
export { TrainOptions, TrainState };