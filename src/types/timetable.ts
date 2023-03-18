import {
	Resource,
	ResourceOptions,
	TimetableEntry,
	User,
	UserLink,
} from "../internal";

interface TimetableOptions extends ResourceOptions {
	entries?: TimetableEntry[];
	name: string;
	genCount: number;
}

class Timetable extends Resource {
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

	public get inUse() {
		return this.session.activeTimetable === this;
	}
	public get checksPassing() {
		return this.runChecks();
	}

	public readonly entries: TimetableEntry[];
	public get nowEntries() {
		return this.entries.filter(
			(e) =>
				e.usedFrom.getTime() <= this.session.timeManager.trueMs &&
				(e.usedTill?.getTime() ?? Number.POSITIVE_INFINITY) >
					this.session.timeManager.trueMs
		);
	}

	constructor(options: TimetableOptions) {
		super(`timetable`, options);

		this._name = options.name;
		this._genCount = options.genCount ?? 5;
		this.entries = options.entries ?? [];
	}

	/**
	 * Checks whether the Timetable is valid to be used (ex. be set as the active timetable)
	 * @returns boolean indicating validity
	 */
	runChecks() {
		// TODO: finsh
		if (this.entries.length === 0) return false;

		return true;
	}

	addEntry(entry: TimetableEntry, actor?: UserLink) {
		actor && User.checkPermission(actor.user, "manage timetables");
		if (this.entries.includes(entry)) return false;

		this.entries.push(entry);
		return true;
	}

	async modify(data: Record<string, unknown>, actor: UserLink) {
		User.checkPermission(actor.user, "manage timetables");
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
			sessionId: this.sessionId,
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

export { Timetable, TimetableOptions };
