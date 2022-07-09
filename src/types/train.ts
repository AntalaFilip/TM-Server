import Locomotive from "./locomotive";
import { MovableLocation, MovableLocationMeta } from "./movable";
import Resource, { ResourceOptions } from "./resource";
import TrainSet from "./trainset";
import User from "./user";

interface TrainOptions extends ResourceOptions {
	name: string,
	short: string,
	locomotive?: Locomotive,
	trainSets?: TrainSet[],
	location?: MovableLocation,
	state?: TrainState,
	currentEntryId?: string,
}

interface TrainOptionsMetadata extends ResourceOptions {
	name: string,
	short: string,
	locomotiveId?: string,
	trainSetIds?: string[],
	location?: MovableLocationMeta,
	state?: TrainState,
	currentEntryId?: string,
}

type TrainState = 'MISSING' | 'MOVING' | 'ARRIVED' | 'READY' | 'LEAVING';

function checkTrainStateValidity(toCheck: unknown): toCheck is TrainState {
	return (
		toCheck === 'MISSING'
		|| toCheck === 'MOVING'
		|| toCheck === 'ARRIVED'
		|| toCheck === 'READY'
		|| toCheck === 'LEAVING'
	);
}

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
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:locomotives`), "*", "id", loco?.id, "type", loco?.type, "time", trueTimestamp);
		this.propertyChange(`locomotive`, loco);
	}

	private _location: MovableLocation;
	public get location() { return this._location; }
	private set location(newloc: MovableLocation) {
		this._location = newloc;
		// TODO: paused time?
		const trueTimestamp = this.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:locations`), "*", "id", newloc?.station.id, "type", newloc?.station.type, "track", newloc?.track?.id, "time", trueTimestamp);
		this.propertyChange(`location`, newloc, true);
	}

	private _state: TrainState;
	public get state() { return this._state; }
	private set state(newState: TrainState) {
		this._state = newState;
		const trueTimestamp = this.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:states`), "*", "data", newState, "type", 'trainState', "time", trueTimestamp);
		this.propertyChange(`state`, newState, true);
	}

	public get allEntries() { return Array.from(this.realm.activeTimetable?.entries.filter(e => e.train === this).values() ?? []).sort((a, b) => a.start.getTime() - b.start.getTime()); }

	private _currentEntryId: string;
	public get currentEntryId() { return this._currentEntryId; }
	private set currentEntryId(id: string) {
		this._currentEntryId = id;
		const trueTimestamp = this.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:entries`), "*", "id", id, "type", "timetableentry", "time", trueTimestamp);
		this.propertyChange(`currentEntryId`, id, true);
	}
	public get currentEntry() { return this.allEntries?.find(e => e.id === this.currentEntryId) ?? this.allEntries[0]; }

	public get nextEntry() { return this.allEntries[this.allEntries.indexOf(this.currentEntry) + 1] ?? this.allEntries[0]; }

	public get arrDepSet() { return this.currentEntry?.current }

	constructor(options: TrainOptions) {
		super('train', options);

		this._name = options.name;
		this._short = options.short;

		this._locomotive = options.locomotive;
		this.trainSets = options.trainSets ?? [];
		this._state = options.state ?? `MISSING`;
		this._location = options.location;
	}

	/**
	 * careful, it throws!
	 * @returns
	 */
	updateTrainState(newState: TrainState, override = false, ...extra: string[]) {
		if (!this.realm.activeTimetable) throw new Error(`There is no active timetable!`);
		const prevState = this.state;
		// TODO: autoskipping and stuff
		if (newState === prevState) return;
		if (newState === 'MOVING') {
			this.location = null;
			if (prevState != 'MISSING') {
				this.currentEntry.nextSet();
				this.currentEntryId = this.nextEntry?.id;
			}
		}
		else if (newState === 'ARRIVED') {
			this.location = {
				station: this.currentEntry.station,
				track: this.currentEntry.station.tracks.get(extra[0]) ?? this.currentEntry.track
			};
		}
		else if (newState === 'READY') {
			this.runStateChecks(override);
		}
		else if (newState === 'LEAVING') {
			if (prevState != 'READY') this.runStateChecks(override);
			this.location = { ...this.location, track: null };
		}
		else if (newState === 'MISSING') {
			this.location = null;
		}

		this.state = newState;
	}

	async modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission('manage trains', this.realm)) throw new Error(`No permission`);
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
		if (typeof data.locomotiveId === 'string' && this.realm.movableManager.getLoco(data.locomotiveId)) {
			this.locomotive = this.realm.movableManager.getLoco(data.locomotiveId);
			modified = true;
		}
		if (Array.isArray(data.trainSetIds) && data.trainSetIds.every(c => typeof c === 'string')) {
			const trainSets = data.trainSetIds.map(c => this.realm.trainSetManager.get(c)).filter(c => c instanceof TrainSet);
			if (trainSets.length === data.trainSetIds.length) {
				await this.newTrainSets(trainSets);
				modified = true;
			}
		}
		if (checkTrainStateValidity(data.state)) {
			this.updateTrainState(data.state, true);
			modified = true;
		}

		if (!modified) return false;
		return true;
	}

	public runStateChecks(override = false) {
		if (!this.realm.activeTimetable) throw new Error(`There is no active timetable!`);
		// TODO: create nice errors
		if (this.trainSets != this.currentEntry?.sets && !override) throw new Error(`Train sets do not match!`);
		if (this.locomotive != this.currentEntry?.locomotive && !override) throw new Error(`Locomotives don't match!`);

		return true;
	}

	public stateChecksPassing() {
		try {
			return this.runStateChecks();
		}
		catch (err) {
			return false;
		}
	}

	async newTrainSets(sets: TrainSet[]) {
		this.trainSets.length = 0;
		this.trainSets.push(...sets);
		const trueTimestamp = this.manager.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:trainsets`), "*", "ids", JSON.stringify(sets.map(s => s.id)), "time", trueTimestamp);
		this.propertyChange(`trainSets`, sets, true);
	}

	metadata(): TrainOptionsMetadata {
		return {
			managerId: this.managerId,
			realmId: this.realmId,
			name: this.name,
			short: this.short,
			id: this.id,
			currentEntryId: this.currentEntryId,
			location: this.location && { stationId: this.location?.station?.id, trackId: this.location?.track?.id },
			locomotiveId: this.locomotive?.id,
			trainSetIds: this.trainSets.map(t => t.id),
			state: this.state,
		};
	}
	publicMetadata() {
		return {
			...this.metadata(),
			checks: this.stateChecksPassing(),
		}
	}
	fullMetadata() {
		return {
			...this.metadata(),
			checks: this.stateChecksPassing(),
			currentEntry: this.currentEntry?.publicMetadata(),
			nextEntry: this.nextEntry?.publicMetadata(),
			location: this.location && Object.fromEntries(Object.entries(this.location).map(([k, v]) => [k, v.publicMetadata()])),
			locomotive: this.locomotive?.publicMetadata(),
			trainSets: this.trainSets.map(t => t.publicMetadata()),
			arrDepSet: this.arrDepSet,
		}
	}

	async save(): Promise<boolean> {
		await this.manager.db.add(this.id, this.metadata());

		return true;
	}
}

export default Train;
export { TrainOptions, TrainState, TrainOptionsMetadata, checkTrainStateValidity };