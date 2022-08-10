import ResourceManager from "../managers/ResourceManager";
import TimetableManager from "../managers/TimetableManager";
import TMError from "./tmerror";

interface ArrDepSetOptions {
	no: number;
	timetableId: string;
	entryId: string;
	managerId: string;
}

class ArrDepSet {
	public readonly managerId: string;
	public get manager() {
		return ResourceManager.get(this.managerId) as TimetableManager;
	}
	public readonly timetableId: string;
	public get timetable() {
		const tt = this.manager.get(this.timetableId);
		if (!tt) throw new TMError(`EINTERNAL`);
		return tt;
	}
	public readonly entryId: string;
	public get entry() {
		const entry = this.timetable.entries.find((e) => e.id === this.entryId);
		if (!entry) throw new Error("Invalid timetable Entry");
		return entry;
	}

	public get arrival() {
		return new Date(
			this.entry.start.getTime() + this.no * this.entry.repeats
		);
	}
	public get departure() {
		if (!this.entry || this.entry.duration < 0) return null;
		return new Date(this.arrival.getTime() + this.entry.duration);
	}
	public readonly no: number;

	public get delay() {
		return this.entry.delayedAds.get(this.no) ?? 0;
	}
	public get cancelled() {
		return this.entry.cancelledAds.includes(this.no);
	}

	constructor(options: ArrDepSetOptions) {
		this.managerId = options.managerId;
		this.timetableId = options.timetableId;
		this.entryId = options.entryId;

		this.no = options.no;
	}
}

export default ArrDepSet;
