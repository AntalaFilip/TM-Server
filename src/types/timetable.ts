import { ForbiddenError } from "apollo-server-core";
import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import { SessionSpecificDataManager } from "../managers/SessionSpecificDataManager";
import TimetableEntry from "./Entry";
import Resource, { ResourceOptions } from "./Resource";
import { SessionSpecificResourceData } from "./SessionSpecificResourceData";
import User from "./User";

interface TimetableOptions extends ResourceOptions {
	entries?: TimetableEntry[];
	name: string;
	genCount: number;
}

class SessionSpecificTimetableData extends SessionSpecificResourceData<Timetable> {
	public sessionData: undefined;
	public get inUse() {
		return this.session.activeTimetable === this.resource;
	}

	public get nowEntries() {
		return this.resource.entries.filter(
			(e) =>
				e.usedFrom.getTime() <= this.session.timeManager.trueMs &&
				(e.usedTill?.getTime() ?? Number.POSITIVE_INFINITY) >
					this.session.timeManager.trueMs
		);
	}

	constructor(
		options: SessionSpecificResourceDataOptions,
		resource: Timetable
	) {
		super(`sessionspecific-timetable`, options, resource);
	}

	metadata(): SessionSpecificResourceDataOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			realmId: this.realmId,
			sessionId: this.sessionId,
		};
	}

	publicMetadata() {
		return this.metadata();
	}

	fullMetadata() {
		return this.metadata();
	}

	modify() {
		return false;
	}

	async save() {
		await this.instanceManager.db.redis.hset(this.instanceManager.id, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}

class SessionSpecificTimetableDataManager extends SessionSpecificDataManager<Timetable> {
	instantiate(
		opts: SessionSpecificResourceDataOptions,
		resource: Timetable
	): SessionSpecificTimetableData {
		return new SessionSpecificTimetableData(opts, resource);
	}
}

class Timetable extends Resource {
	public sessionData: SessionSpecificTimetableDataManager;

	private _name: string;
	public get name() {
		return this._name;
	}
	private set name(name: string) {
		this._name = name;
		this.propertyChange(`name`, name);
	}

	private _genCount: number;
	public get genCount() {
		return this._genCount;
	}
	private set genCount(count: number) {
		this._genCount = count || 5;
		this.propertyChange(`genCount`, count);
	}
	public get checksPassing() {
		return this.runChecks();
	}

	public readonly entries: TimetableEntry[];

	constructor(options: TimetableOptions) {
		super(`timetable`, options);

		this._name = options.name;
		this._genCount = options.genCount ?? 5;
		this.entries = options.entries ?? [];

		this.sessionData = new SessionSpecificTimetableDataManager(
			this.realm,
			this
		);
	}

	/**
	 * Checks whether the Timetable is valid to be used (ex. be set as the active timetable)
	 * @returns boolean indicating validity
	 */
	runChecks() {
		if (this.entries.length === 0) return false;
		// HACK: implement timetable checks properly
		// if (!this.entries.every((e) => e.times.length > 0)) return false;

		return true;
	}

	addEntry(entry: TimetableEntry, actor?: User) {
		if (actor && !actor.hasPermission(`manage timetables`, this.realm))
			throw new ForbiddenError(`No permission`, {
				tmCode: `ENOPERM`,
				permission: `manage timetables`,
			});
		if (this.entries.includes(entry)) return false;

		this.entries.push(entry);
		return true;
	}

	async modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage timetables", this.realm))
			throw new Error(`No permission`);
		let modified = false;

		// TODO: auditing

		if (typeof data.name === "string") {
			this.name = data.name;
			modified = true;
		}
		if (typeof data.genCount === "number") {
			this.genCount = data.genCount;
			modified = true;
		}

		if (!modified) return false;
		return true;
	}

	metadata(): TimetableOptions {
		return {
			managerId: this.managerId,
			realmId: this.realmId,
			id: this.id,
			name: this.name,
			genCount: this.genCount,
		};
	}
	publicMetadata() {
		return {
			...this.metadata(),
			entryIds: this.entries.map((e) => e.id),
		};
	}
	fullMetadata() {
		return {
			...this.metadata(),
			entries: this.entries.map((e) => e.publicMetadata()),
		};
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.manager.id, [
			`${this.id}:metadata`,
			JSON.stringify(this.metadata()),
		]);

		for (const entry of this.entries) {
			await entry.save();
		}

		return true;
	}
}

export default Timetable;
export { TimetableOptions, SessionSpecificTimetableData };
