import {
	ArrDepSet,
	Errors,
	LocomotiveLink,
	MovableLocation,
	MovableLocationMeta,
	Resource,
	ResourceOptions,
	StationTrackLink,
	TimetableEntry,
	TMError,
	TrainSet,
	User,
	UserLink,
} from "../internal";

interface TrainOptions extends ResourceOptions {
	name: string;
	short: string;
	locomotiveLink?: LocomotiveLink;
	trainSets?: TrainSet[];
	location?: MovableLocation;
	state?: TrainState;
	currentADSId?: string;
}

interface TrainOptionsMetadata extends ResourceOptions {
	name: string;
	short: string;
	locomotiveLinkId?: string;
	trainSetIds?: string[];
	location?: MovableLocationMeta;
	state?: TrainState;
	currentADSId?: string;
}

const TrainStates = {
	MISSING: 1 << 1,
	MOVING: 1 << 2,
	ARRIVED: 1 << 3,
	READY: 1 << 4,
	LEAVING: 1 << 5,
	ALLOCATED: 1 << 6,
};
type TrainState = keyof typeof TrainStates;

function checkTrainStateValidity(toCheck: unknown): toCheck is TrainState {
	return (
		typeof toCheck === "string" &&
		Object.keys(TrainStates).includes(toCheck)
	);
}

class Train extends Resource {
	public readonly trainSets: TrainSet[];
	public override readonly type = "train";

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

	private _locomotiveLink?: LocomotiveLink;
	public get locomotiveLink() {
		return this._locomotiveLink;
	}
	private set locomotiveLink(loco: LocomotiveLink | undefined) {
		this._locomotiveLink = this.locomotiveLink;
		const trueTimestamp = this.session.timeManager.trueMs;
		// TODO: what about paused time?
		this.manager.db.redis.xadd(
			this.manager.key(`${this.id}:locomotives`),
			"*",
			"id",
			loco?.id ?? "",
			"type",
			loco?.type ?? "",
			"time",
			trueTimestamp
		);
		this.propertyChange(`locomotivelink`, loco);
	}

	private _location?: MovableLocation;
	public get location() {
		return this._location;
	}
	private set location(newloc: MovableLocation | undefined) {
		this._location = newloc;
		// TODO: paused time?
		const trueTimestamp = this.session.timeManager.trueMs;
		this.manager.db.redis.xadd(
			this.manager.key(`${this.id}:locations`),
			"*",
			"id",
			newloc?.stationLink.id ?? "",
			"type",
			newloc?.stationLink.type ?? "",
			"track",
			newloc?.trackLink?.id ?? "",
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
		this.manager.db.redis.xadd(
			this.manager.key(`${this.id}:states`),
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

	public get entries() {
		return Array.from(
			this.session.activeTimetable?.entries
				.filter((e) => e.train === this)
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
		this.manager.db.redis.xadd(
			this.manager.key(`${this.id}:ads`),
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
	public get currentADS(): ArrDepSet | undefined {
		if (!this.currentADSId) return;
		return this.session.aDSManager.get(this.currentADSId);
	}

	public get currentEntry(): TimetableEntry | undefined {
		return this.currentADS?.entry;
	}

	constructor(options: TrainOptions) {
		super("train", options);

		this._name = options.name;
		this._short = options.short;

		this._locomotiveLink = options.locomotiveLink;
		this.trainSets = options.trainSets ?? [];
		this._state = options.state ?? `MISSING`;
		this._location = options.location;
		this._currentADSId = options.currentADSId;
	}

	/**
	 * careful, it throws!
	 * @returns
	 */
	async updateTrainState(
		newState: TrainState,
		actor?: UserLink,
		override = false,
		...extra: string[]
	) {
		if (!this.session.activeTimetable)
			throw new TMError(
				`ENOACTIVETIMETABLE`,
				`There is no active timetable!`
			);
		if (
			actor &&
			!User.checkPermission(
				actor.user,
				"manage trains",
				this.session,
				false
			) &&
			this.locomotiveLink?.controller !== actor &&
			this.location?.stationLink.dispatcher !== actor
		)
			throw Errors.forbidden([`manage trains`]);

		const prevState = this.state;
		if (!this.currentADS) {
			throw new TMError(
				`ENOCURRENTADS`,
				`There is no current ADS for this Train!`
			);
		}

		// TODO: autoskipping and stuff
		if (newState === prevState) return;
		if (prevState === "MISSING")
			throw new TMError(
				`ETRILLEGALSTATECHANGE`,
				`You may not change the train state from MISSING.
				Please reset the train state using Train::found`
			);
		if (newState === "MOVING") {
			this.location = undefined;
		} else if (newState === "ALLOCATED") {
			// TODO: track allocations
		} else if (newState === "ARRIVED") {
			const track: StationTrackLink | undefined =
				this.currentADS.stationLink?.trackLinks.get(extra[0]) ??
				this.currentADS.trackLink;

			if (track.currentTrain && track.currentTrain !== this)
				throw new Error("Track is occupied!");

			this.currentADS.setArrived();
			this.location = {
				stationLink: this.currentADS.stationLink,
				trackLink: track,
			};
		} else if (newState === "READY") {
			this.runStateChecks(override);
		} else if (newState === "LEAVING") {
			if (prevState !== "READY") this.runStateChecks(override);
			if (!this.location)
				throw new TMError(`EINTERNAL`, `Invalid location!`);
			this.location = { ...this.location, trackLink: undefined };

			const next = await this.currentADS.nextADS();
			next.setDeparted();
			this.currentADSId = next.id;
		} else if (newState === "MISSING") {
			this.location = undefined;
			// TODO: fix up everything that will break here (unfinished ADS....)
			this.currentADSId = undefined;
		}

		this.state = newState;
	}

	async modify(data: Record<string, unknown>, actor: UserLink) {
		User.checkPermission(actor.user, "manage trains", this.session);
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
		if (
			typeof data.locomotiveId === "string" &&
			this.session.movableLinkManager.getLocoLink(data.locomotiveId)
		) {
			this.locomotiveLink = this.session.movableLinkManager.getLocoLink(
				data.locomotiveId
			);
			modified = true;
		}
		if (
			Array.isArray(data.trainSetIds) &&
			data.trainSetIds.every((c) => typeof c === "string")
		) {
			const trainSets = data.trainSetIds
				.map((c) => this.session.trainSetManager.get(c))
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

		if (!modified) return false;
		return true;
	}

	public runStateChecks(override = false) {
		if (!this.session.activeTimetable)
			throw new TMError(
				`ETRCHKNOACTIVETIMETABLE`,
				`There is no active timetable!`,
				{ train: this.id }
			);
		if (this.trainSets !== this.currentEntry?.sets && !override)
			throw new TMError(`ETRCHKSETSNOMATCH`, `Train sets do not match!`, {
				train: this.id,
				expectedSets: this.currentEntry?.sets.map((s) => s.id),
				currentSets: this.trainSets.map((s) => s.id),
			});
		if (
			this.locomotiveLink !== this.currentEntry?.locomotiveLink &&
			!override
		)
			throw new TMError(
				`ETRCHKLOCONOMATCH`,
				`Locomotive links do not match!`,
				{
					train: this.id,
					expectedLocomotiveLink:
						this.currentEntry?.locomotiveLink.id,
					currentLocomotiveLink: this.locomotiveLink?.id,
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
		const trueTimestamp = this.manager.session.timeManager.trueMs;
		await this.manager.db.redis.xadd(
			this.manager.key(`${this.id}:trainsets`),
			"*",
			"ids",
			JSON.stringify(sets.map((s) => s.id)),
			"time",
			trueTimestamp
		);
		this.propertyChange(`trainSets`, sets, true);
	}

	metadata(): TrainOptionsMetadata {
		return {
			managerId: this.managerId,
			sessionId: this.sessionId,
			name: this.name,
			short: this.short,
			id: this.id,
			currentADSId: this.currentADSId,
			location: this.location && {
				stationLinkId: this.location?.stationLink?.id,
				trackLinkId: this.location?.trackLink?.id,
			},
			locomotiveLinkId: this.locomotiveLink?.id,
			trainSetIds: this.trainSets.map((t) => t.id),
			state: this.state,
		};
	}
	publicMetadata() {
		return {
			...this.metadata(),
			checks: this.stateChecksPassing(),
		};
	}
	fullMetadata() {
		return this.metadata();
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.manager.id, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}

export {
	Train,
	TrainOptions,
	TrainState,
	TrainStates,
	TrainOptionsMetadata,
	checkTrainStateValidity,
};
