import ResourceManager from "../managers/ResourceManager";
import TimetableManager from "../managers/TimetableManager";

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
		return this.manager.get(this.timetableId);
	}
	public readonly entryId: string;
	public get entry() {
		return this.timetable.entries.find((e) => e.id === this.entryId);
	}

	public get arrival() {
		return new Date(
			this.entry.start.getTime() + this.no * this.entry.repeats
		);
	}
	public get departure() {
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
