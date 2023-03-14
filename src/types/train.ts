import { ForbiddenError } from "apollo-server-core";
import { SessionSpecificDataManager } from "../managers/SessionSpecificDataManager";
import { SessionSpecificResourceData } from "./SessionSpecificResourceData";
import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import TimetableEntry from "./Entry";
import Locomotive from "./Locomotive";
import { MovableLocation } from "./Movable";
import Resource, { ResourceOptions } from "./Resource";
import TMError from "./TMError";
import StationTrack from "./Track";
import TrainSet from "./TrainSet";
import User from "./User";

interface TrainOptions extends ResourceOptions {
	name: string;
	short: string;
	locomotive?: Locomotive;
	trainSets?: TrainSet[];
	location?: MovableLocation;
	state?: TrainState;
	currentADSId?: string;
}

interface TrainOptionsMetadata extends ResourceOptions {
	name: string;
	short: string;
}

const TrainStates = {
	MISSING: 1 << 1,
	MOVING: 1 << 2,
	ARRIVED: 1 << 3,
	READY: 1 << 4,
	LEAVING: 1 << 5,
};
type TrainState = keyof typeof TrainStates;

function checkTrainStateValidity(toCheck: unknown): toCheck is TrainState {
	return (
		typeof toCheck === "string" &&
		Object.keys(TrainStates).includes(toCheck)
	);
}

interface SessionSpecificTrainDataOptions
	extends SessionSpecificResourceDataOptions {
	locomotive?: Locomotive;
	trainSets?: TrainSet[];
	location?: MovableLocation;
	state?: TrainState;
	currentADSId?: string;
}

class SessionSpecificTrainDataManager extends SessionSpecificDataManager<Train> {
	instantiate(
		opts: SessionSpecificResourceDataOptions,
		resource: Train
	): SessionSpecificTrainData {
		return new SessionSpecificTrainData(opts, resource);
	}
	protected override async createAllFromStore() {
		await this.resource.realm.stationManager.ready;
		await this.resource.realm.movableManager.ready;
		await this.resource.realm.trainSetManager.ready;

		const allSessionData = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allSessionData);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as SessionSpecificTrainDataOptions;

				const locod = await this.db.redis.xrevrange(
					this.key(`${v.id}:locomotives`),
					"+",
					"-",
					"COUNT",
					1
				);
				if (locod[0] && locod[0][1]) {
					const id = locod[0][1][1];
					const type = locod[0][1][3];
					if (type === "locomotive" && id) {
						v.locomotive =
							this.resource.realm.movableManager.getLoco(id);
					}
				}

				const locd = await this.db.redis.xrevrange(
					this.key(`${v.id}:locations`),
					"+",
					"-",
					"COUNT",
					1
				);
				if (locd[0] && locd[0][1]) {
					const id = locd[0][1][1];
					const type = locd[0][1][3];
					const trkid = locd[0][1][5];
					if (type === "station" && id) {
						const stat = this.resource.realm.stationManager.get(id);
						const trk = stat?.tracks.find((t) => t.id === trkid);
						if (stat) {
							v.location = {
								station: stat,
								track: trk,
							};
						}
					}
				}

				const statd = await this.db.redis.xrevrange(
					this.key(`${v.id}:states`),
					"+",
					"-",
					"COUNT",
					1
				);
				if (statd[0] && statd[0][1]) {
					const data = statd[0][1][1] as TrainState;
					const type = statd[0][1][3];
					if (type === "trainState") {
						v.state = data;
					}
				}

				const adsd = await this.db.redis.xrevrange(
					this.key(`${v.id}:arrdepsets`),
					"+",
					"-",
					"COUNT",
					1
				);
				if (adsd[0] && adsd[0][1]) {
					const id = adsd[0][1][1];
					const type = adsd[0][1][3];
					if (type === "arrdepset" && id) {
						v.currentADSId = id;
					}
				}

				const trsd = await this.db.redis.xrevrange(
					this.key(`${v.id}:trainsets`),
					"+",
					"-",
					"COUNT",
					1
				);
				if (trsd[0] && trsd[0][1]) {
					const ids = JSON.parse(trsd[0][1][1]) as string[];
					v.trainSets = ids
						.map((id) =>
							this.resource.realm.trainSetManager.get(id)
						)
						.filter((i) => i instanceof TrainSet) as TrainSet[];
				}

				await this.create(v);
			} catch (err) {
				this.logger.warn(
					`Malformed session-specific train data @ ${r[0]}`
				);
			}
		}
	}
}

class SessionSpecificTrainData extends SessionSpecificResourceData {
	public sessionData: undefined;
	public readonly trainSets: TrainSet[];

	private _locomotive?: Locomotive;
	public get locomotive() {
		return this._locomotive;
	}
	private set locomotive(loco: Locomotive | undefined) {
		this._locomotive = loco;
		const trueTimestamp = this.session.timeManager.trueMs;
		// TODO: what about paused time?
		this.instanceManager.db.redis.xadd(
			this.instanceManager.key(`${this.id}:locomotives`),
			"*",
			"id",
			loco?.id ?? "",
			"type",
			loco?.type ?? "",
			"time",
			trueTimestamp
		);
		this.propertyChange(`locomotive`, loco);
	}

	private _location?: MovableLocation;
	public get location() {
		return this._location;
	}
	private set location(newloc: MovableLocation | undefined) {
		this._location = newloc;
		// TODO: paused time?
		const trueTimestamp = this.session.timeManager.trueMs;
		this.instanceManager.db.redis.xadd(
			this.instanceManager.key(`${this.id}:locations`),
			"*",
			"id",
			newloc?.station.id ?? "",
			"type",
			newloc?.station.type ?? "",
			"track",
			newloc?.track?.id ?? "",
			"time",
			trueTimestamp
		);
		this.propertyChange(`location`, newloc, true);
	}

	private _state: TrainState;
	public get state() {
		return this._state;
	}
	private set state(newState: TrainState) {
		this._state = newState;
		const trueTimestamp = this.session.timeManager.trueMs;
		this.instanceManager.db.redis.xadd(
			this.instanceManager.key(`${this.id}:states`),
			"*",
			"data",
			newState,
			"type",
			"trainState",
			"time",
			trueTimestamp
		);
		this.propertyChange(`state`, newState, true);
	}

	public get allEntries() {
		return Array.from(
			this.session.activeTimetable?.entries
				.filter((e) => e.train === this.resource)
				.values() ?? []
		).sort((a, b) => a.start.getTime() - b.start.getTime());
	}

	private _currentADSId?: string;
	public get currentADSId() {
		return this._currentADSId;
	}
	private set currentADSId(id: string | undefined) {
		this._currentADSId = id;
		const trueTimestamp = this.session.timeManager.trueMs;
		this.instanceManager.db.redis.xadd(
			this.instanceManager.key(`${this.id}:ads`),
			"*",
			"id",
			this.currentADSId ?? "",
			"type",
			this.currentADS?.type ?? "",
			"time",
			trueTimestamp
		);
		this.propertyChange(`currentADSId`, id, true);
	}
	public get currentADS() {
		if (!this.currentADSId) return;
		return this.session.aDSManager.get(this.currentADSId);
	}

	public get currentEntry(): TimetableEntry | undefined {
		return this.currentADS?.entry;
	}

	constructor(options: SessionSpecificTrainDataOptions, resource: Train) {
		super("sessionspecific-train", options, resource);

		this._locomotive = options.locomotive;
		this.trainSets = options.trainSets ?? [];
		this._state = options.state ?? "MISSING";
		this.location = options.location;
		this._currentADSId = options.currentADSId;
	}

	publicMetadata() {
		return {
			id: this.id,
			managerId: this.managerId,
			realmId: this.realmId,
			sessionId: this.sessionId,
		};
	}

	metadata(): SessionSpecificResourceDataOptions {
		return this.publicMetadata();
	}

	fullMetadata() {
		return this.metadata();
	}

	async modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage trains", this.realm))
			throw new ForbiddenError(`No permission`, {
				permission: `manage trains`,
			});
		let modified = false;
		if (
			typeof data.locomotiveId === "string" &&
			this.realm.movableManager.getLoco(data.locomotiveId)
		) {
			this.locomotive = this.realm.movableManager.getLoco(
				data.locomotiveId
			);
			modified = true;
		}
		if (
			Array.isArray(data.trainSetIds) &&
			data.trainSetIds.every((c) => typeof c === "string")
		) {
			const trainSets = data.trainSetIds
				.map((c) => this.realm.trainSetManager.get(c))
				.filter((c) => c instanceof TrainSet) as TrainSet[];
			if (trainSets.length === data.trainSetIds.length) {
				await this.newTrainSets(trainSets);
				modified = true;
			}
		}
		if (checkTrainStateValidity(data.state)) {
			this.updateTrainState(data.state, actor, true);
			modified = true;
		}

		return modified;
	}

	async save() {
		await this.instanceManager.db.redis.hset(this.instanceManager.id, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}

	/**
	 * careful, it throws!
	 * @returns
	 */
	updateTrainState(
		newState: TrainState,
		actor?: User,
		override = false,
		...extra: string[]
	) {
		if (!this.session)
			throw new TMError(
				`ENOACTIVESESSION`,
				`There is no active session!`
			);
		if (!this.session.activeTimetable)
			throw new TMError(
				`ENOACTIVETIMETABLE`,
				`There is no active timetable!`
			);
		if (
			actor &&
			!actor.hasPermission("manage trains", this.realm) &&
			this.locomotive?.sessionData.get(this.sessionId)?.controller !==
				actor &&
			this.location?.station.sessionData.get(this.session.id)
				?.dispatcher !== actor
		)
			throw new ForbiddenError(
				`You do not have permission to interact with this Train!`,
				{ tmCode: `ENOPERM`, permission: `manage trains` }
			);
		const prevState = this.state;
		if (!this.currentADS)
			throw new TMError(
				`ENOCURRENTADS`,
				`There is no current ADS for this Train!`
			);
		// TODO: autoskipping and stuff
		if (newState === prevState) return;
		if (newState === "MOVING") {
			this.location = undefined;
			// TODO: check whether this condition doesn't actually break things.
			if (prevState !== "MISSING") {
				this.currentADSId = this.currentADS?.nextSet?.id;
			}
		} else if (newState === "ARRIVED") {
			const track: StationTrack | undefined =
				this.currentADS.station?.tracks.get(extra[0]) ??
				this.currentADS.track;

			const current = track?.sessionData.get(
				this.sessionId
			)?.currentTrain;
			if (current && current !== this.resource)
				throw new TMError(`ETRACKOCCUPIED`, "Track is occupied!");

			this.location = {
				station: this.currentADS.station,
				track,
			};
		} else if (newState === "READY") {
			this.runStateChecks(override);
		} else if (newState === "LEAVING") {
			if (prevState !== "READY") this.runStateChecks(override);
			if (!this.location)
				throw new TMError(`EINTERNALERROR`, `Invalid location!`);
			this.location = { ...this.location, track: undefined };
		} else if (newState === "MISSING") {
			this.location = undefined;
		}

		this.state = newState;
	}

	public runStateChecks(override = false) {
		if (!this.session.activeTimetable)
			throw new TMError(
				`ETRCHKNOACTIVETIMETABLE`,
				`There is no active timetable!`,
				{ train: this.id }
			);
		if (this.trainSets != this.currentADS?.sets && !override)
			throw new TMError(`ETRCHKSETSNOMATCH`, `Train sets do not match!`, {
				train: this.id,
				expectedSets: this.currentADS?.sets.map((s) => s.id),
				currentSets: this.trainSets.map((s) => s.id),
			});
		if (this.locomotive != this.currentADS?.locomotive && !override)
			throw new TMError(
				`ETRCHKLOCONOMATCH`,
				`Locomotives do not match!`,
				{
					train: this.id,
					expectedLocomotive: this.currentADS?.locomotive.id,
					currentLocomotive: this.locomotive?.id,
				}
			);

		return true;
	}

	public stateChecksPassing() {
		try {
			return this.runStateChecks();
		} catch (err) {
			if (err instanceof TMError && err.code.startsWith("ETRCHK"))
				return false;
			else throw err;
		}
	}

	async newTrainSets(sets: TrainSet[]) {
		this.trainSets.length = 0;
		this.trainSets.push(...sets);
		const trueTimestamp = this.session.timeManager.trueMs;
		await this.instanceManager.db.redis.xadd(
			this.instanceManager.key(`${this.id}:trainsets`),
			"*",
			"ids",
			JSON.stringify(sets.map((s) => s.id)),
			"time",
			trueTimestamp
		);
		this.propertyChange(`trainSets`, sets, true);
	}
}

class Train extends Resource {
	public sessionData: SessionSpecificTrainDataManager;

	private _name: string;
	public get name() {
		return this._name;
	}
	private set name(name: string) {
		this._name = name;
	}

	private _short: string;
	public get short() {
		return this._short;
	}
	private set short(short: string) {
		this._short = short;
	}

	constructor(options: TrainOptions) {
		super("train", options);

		this._name = options.name;
		this._short = options.short;
		this.sessionData = new SessionSpecificTrainDataManager(
			this.realm,
			this
		);
	}

	async modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage trains", this.realm))
			throw new ForbiddenError(`No permission`, {
				permission: `manage trains`,
			});
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

		return modified;
	}

	metadata(): TrainOptionsMetadata {
		return {
			managerId: this.managerId,
			realmId: this.realmId,
			name: this.name,
			short: this.short,
			id: this.id,
		};
	}
	publicMetadata() {
		return {
			...this.metadata(),
		};
	}
	fullMetadata() {
		return {
			...this.metadata(),
		};
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.manager.id, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}

export default Train;
export {
	TrainOptions,
	TrainState,
	TrainStates,
	TrainOptionsMetadata,
	checkTrainStateValidity,
	SessionSpecificTrainData,
	SessionSpecificTrainDataOptions,
};
