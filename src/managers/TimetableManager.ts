import Collection from "@discordjs/collection";
import TimetableEntry, { TimetableEntryOptions } from "../types/entry";
import Realm from "../types/realm";
import Timetable, { TimetableOptions } from "../types/timetable";
import ResourceManager from "./ResourceManager";

class TimetableManager extends ResourceManager {
	public readonly timetables: Collection<string, Timetable>;
	public readonly ready: Promise<void>;

	constructor(realm: Realm) {
		super(realm, `timetables`);

		this.timetables = new Collection();

		this.ready = new Promise(res => {
			this.createAllFromStore()
				.then(() => {
					console.log(`TimetableManager (${this.id}) ready; loaded ${this.timetables.size} timetables. Current active timetable: ${this.realm.activeTimetable?.name ?? 'none'}`);
					res();
				});
		});
	}

	get(id: string): Timetable {
		return this.timetables.get(id);
	}

	async fromResourceIdentifier(fullId: string): Promise<Timetable> {
		if (!await this.db.redis.exists(fullId)) return;

		const timetableMeta = await this.db.get(fullId) as TimetableOptions;

		const entriesData = await this.db.redis.hgetall(`${fullId}:entries`);
		const entries = Object.entries(entriesData).map(([_k, v]) => JSON.parse(v) as TimetableEntryOptions).map(meta => new TimetableEntry(meta));
		timetableMeta.entries = entries;

		return new Timetable(timetableMeta);
	}

	async create(resource: Timetable | TimetableOptions): Promise<Timetable> {
		if (!(resource instanceof Timetable)) {
			resource = new Timetable(resource);
		}
		if (!(resource instanceof Timetable)) return;

		if (this.timetables.has(resource.id)) throw new Error(`This Timetable is already created!`);

		this.timetables.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	private async createAllFromStore() {
		const prefix = process.env.REDIS_PREFIX;
		const allTimetableIds = (await this.db.redis.keys(`${prefix}${this.id}:*[a-Z^:]`)).map(k => k.slice(prefix.length));
		if (!allTimetableIds || allTimetableIds.length === 0) return;

		const allTimetables = await this.db.redis.mget(allTimetableIds);
		const arr = allTimetableIds.map((v, i) => [v, allTimetables[i]]);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as TimetableOptions;
				const entriesData = await this.db.redis.hgetall(this.key(`${k}:entries`));
				const entries = Object.entries(entriesData).map(([_k, meta]) => JSON.parse(meta) as TimetableEntryOptions).map(meta => new TimetableEntry(meta));
				v.entries = entries;

				await this.create(v);
			}
			catch {
				console.warn(`Malformed timetable data @ ${r[0]}`)
			}
		}

		return true;
	}
}

export default TimetableManager;