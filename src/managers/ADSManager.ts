import { Collection } from "@discordjs/collection";
import {
	ArrDepSet,
	ArrDepSetOptions,
	newUUID,
	Session,
	SessionResourceManager,
	TimetableEntry,
	TMError,
	User,
	UserLink,
} from "../internal";

// TODO: rework to generic ActionManager
class ADSManager extends SessionResourceManager {
	public readonly arrdepsets: Collection<string, ArrDepSet>;
	public readonly ready: Promise<void>;

	constructor(session: Session) {
		super(session, `ads`);

		this.arrdepsets = new Collection();
		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(`Ready; loaded ${this.arrdepsets.size} ADS`);
				res();
			});
		});
	}

	get(id: string, error: true): ArrDepSet;
	get(id: string): ArrDepSet | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.arrdepsets.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.arrdepsets.map((s) => s.fullMetadata());
	}

	async regenerateADS(): Promise<ArrDepSet[]> {
		const prevState = this.session.sessionState;
		const timetable = this.session.activeTimetable;
		if (!timetable) throw new TMError(`ENOACTIVETIMETABLE`);
		// Automatically pauses and locks time and disabled interactions that could break this process
		this.session.setSessionState("SYSTEM_SETUP");
		// Clear all ArrDepSets that have a timetable
		await this.clearTimetableADS();
		// Create the ArrDepSets
		const entries = timetable.entries;
		const generated = [];
		for (const entry of entries) {
			for (let i = 1; i <= timetable.genCount; i++) {
				const ads = await this.create(this.fromEntry(entry, i));
				generated.push(ads);
			}
		}
		// Unlock the session back to its previous state
		this.session.setSessionState(prevState);
		return generated;
	}
	async clearTimetableADS() {
		const time = this.session.timeManager;
		const toRemove = this.arrdepsets.filter(
			(ads) =>
				Boolean(ads.timetable) &&
				ads.scheduledArrival.getTime() > time.trueDate.getTime()
		);
		const idsRemove = toRemove.map((ads) => ads.id);
		this.arrdepsets.sweep((ads) => idsRemove.includes(ads.id));
		await this.db.redis.hdel(this.id, ...idsRemove);
	}

	fromEntry(entry: TimetableEntry, rpt: number): ArrDepSet {
		const arr = new Date(entry.usedFrom.getTime() * entry.repeats * rpt);
		const dep = new Date(arr.getTime() + entry.duration * 1000);
		const ads = new ArrDepSet({
			id: newUUID(),
			entryId: entry.id,
			timetableId: entry.timetable.id,
			arrivalDelay: 0,
			departureDelay: 0,
			locomotiveLinkId: entry.locomotiveLink.id,
			managerId: this.id,
			scheduledArrival: arr,
			scheduledDeparture: dep,
			sessionId: this.session.id,
			setIds: entry.setIds,
			stationLinkId: entry.stationLink.id,
			trackLinkId: entry.trackLink.id,
			trainId: entry.train.id,
			rpt,
		});
		return ads;
	}

	async create(
		resource: ArrDepSet | ArrDepSetOptions,
		actor?: UserLink
	): Promise<ArrDepSet> {
		actor &&
			User.checkPermission(actor.user, "manage timetables", this.session);

		if (!(resource instanceof ArrDepSet)) {
			resource = new ArrDepSet(resource);
		}

		if (this.arrdepsets.has(resource.id))
			throw new Error(`This ArrDepSet is already created!`);

		if (!(resource instanceof ArrDepSet)) {
			throw new Error();
		}

		this.arrdepsets.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	async fromResourceIdentifier(_fullId: string) {
		throw new Error("not implemented");
		return undefined;
	}

	private async createAllFromStore() {
		const allADS = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allADS);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as ArrDepSetOptions;
				await this.create(v);
			} catch (err) {
				this.logger.warn(`Malformed station data @ ${r[0]}`);
				if (err instanceof Error) this.logger.verbose(err.message);
			}
		}
	}
}

export { ADSManager };
