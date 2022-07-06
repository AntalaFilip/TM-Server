import TimetableEntry from "./entry";
import Resource, { ResourceOptions } from "./resource";

interface TimetableOptions extends ResourceOptions {
	entries?: TimetableEntry[],
	name: string,
	genCount: number,
}

class Timetable extends Resource {
	private _name: string;
	public get name() { return this._name; }
	private set name(name: string) {
		this._name = name;
		this.propertyChange(`name`, name);
	}

	private _genCount: number;
	public get genCount() { return this._genCount; }
	private set genCount(count: number) {
		this._genCount = count || 5;
		this.propertyChange(`genCount`, count);
	}

	public readonly entries: TimetableEntry[];
	// public readonly timer: NodeJS.Timer;

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
		if (this.entries.length === 0) return false;
		if (!this.entries.every(e => e.times.length > 0)) return false;

		return true;
	}

	addEntry(entry: TimetableEntry) {
		if (this.entries.includes(entry)) return false;

		this.entries.push(entry);
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
			entryIds: this.entries.map(e => e.id),
		}
	}
	fullMetadata() {
		return {
			...this.metadata(),
			entries: this.entries.map(e => e.publicMetadata()),
		}
	}

	async save(): Promise<boolean> {
		await this.manager.db.add(`${this.id}:metadata`, JSON.stringify(this.metadata()));

		for (const entry of this.entries) {
			await entry.save();
		}

		return true;
	}
}

export default Timetable;
export { TimetableOptions };