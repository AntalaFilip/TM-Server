import Collection from "@discordjs/collection";
import { ForbiddenError } from "apollo-server-core";
import TimetableEntry, { TimetableEntryOptions } from "../types/Entry";
import Realm from "../types/Realm";
import Timetable, { TimetableOptions } from "../types/Timetable";
import TMError from "../types/TMError";
import User from "../types/User";
import ResourceManager from "./ResourceManager";

class TimetableManager extends ResourceManager {
	public readonly timetables: Collection<string, Timetable>;
	public readonly ready: Promise<void>;

	constructor(realm: Realm) {
		super(realm, `timetables`);

		this.timetables = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.timetables.size} timetables.`
				);
				res();
			});
		});
	}

	get(id: string): Timetable | undefined {
		return this.timetables.get(id);
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.timetables.map((tt) => tt.fullMetadata());
	}

	async fromResourceIdentifier(
		fullId: string
	): Promise<Timetable | undefined> {
		if (!(await this.db.redis.exists(fullId))) return;

		const timetableMeta = (await this.db.get(fullId)) as TimetableOptions;

		const entriesData = await this.db.redis.hgetall(`${fullId}:entries`);
		const entries = Object.entries(entriesData)
			.map(([_k, v]) => JSON.parse(v) as TimetableEntryOptions)
			.map((meta) => new TimetableEntry(meta));
		timetableMeta.entries = entries;

		return new Timetable(timetableMeta);
	}

	async create(
		resource: Timetable | TimetableOptions,
		actor?: User
	): Promise<Timetable> {
		if (actor && !actor.hasPermission("manage timetables", this.realm))
			throw new ForbiddenError(`No permission!`, {
				tmCode: `ENOPERM`,
				permission: `manage timetables`,
			});

		if (!(resource instanceof Timetable)) {
			resource = new Timetable(resource);
		}
		if (!(resource instanceof Timetable)) throw new TMError("EINTERNAL");

		if (this.timetables.has(resource.id))
			throw new Error(`This Timetable is already created!`);

		this.timetables.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	private async createAllFromStore() {
		const allTimetables = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allTimetables);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as TimetableOptions;
				const entriesData = await this.db.redis.hgetall(
					this.key(`${k}:entries`)
				);
				const entries = Object.entries(entriesData)
					.map(
						([_k, meta]) =>
							JSON.parse(meta) as TimetableEntryOptions
					)
					.map((meta) => new TimetableEntry(meta));
				v.entries = entries;

				await this.create(v);
			} catch {
				this.logger.warn(`Malformed timetable data @ ${r[0]}`);
			}
		}

		return true;
	}
}

export default TimetableManager;
