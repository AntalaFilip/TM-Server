import Collection from "@discordjs/collection";
import {
	Session,
	SessionResourceManager,
	Timetable,
	TimetableEntry,
	TimetableEntryOptions,
	TimetableOptions,
	TMError,
	User,
	UserLink,
} from "../internal";

class TimetableManager extends SessionResourceManager {
	public readonly timetables: Collection<string, Timetable>;
	public readonly ready: Promise<void>;

	constructor(realm: Session) {
		super(realm, `timetables`);

		this.timetables = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${
						this.timetables.size
					} timetables. Current active timetable: ${
						this.session.activeTimetable?.name ?? "none"
					}`
				);
				res();
			});
		});
	}

	get(id: string, error: true): Timetable;
	get(id: string, error?: boolean): Timetable | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.timetables.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
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
		actor?: UserLink
	): Promise<Timetable> {
		actor &&
			User.checkPermission(actor.user, "manage timetables", this.session);

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

export { TimetableManager };
