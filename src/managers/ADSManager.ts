import { Collection } from "@discordjs/collection";
import TMLogger from "../helpers/logger";
import ArrDepSet, { ArrDepSetOptions } from "../types/ArrDepSet";
import Session from "../types/Session";
import TMError from "../types/TMError";
import User from "../types/User";
import BaseManager from "./BaseManager";
import { ResourceData } from "./ResourceManager";

class ADSManager extends BaseManager implements ResourceData<ADSManager> {
	public readonly arrdepsets: Collection<string, ArrDepSet>;
	public readonly ready: Promise<void>;
	override readonly logger: TMLogger;

	public readonly realmId: string;
	public get realm() {
		const r = this.client.get(this.realmId);
		if (!r) throw new TMError(`EINTERNAL`);
		return r;
	}
	public readonly sessionId: string;
	public get session() {
		const s = this.realm.sessionManager.get(this.sessionId);
		if (!s) throw new TMError(`EINTERNAL`);
		return s;
	}

	constructor(session: Session) {
		super(
			`realms:${session.realm.id}:sessions:${session.id}:ads`,
			session.realm.client.io,
			session.realm.client
		);

		this.logger = new TMLogger(
			`ADS:${session.realm.id}:${session.id}`,
			`ADS:${session.realm.shortId}:${session.shortId}`
		);
		this.realmId = session.realm.id;
		this.sessionId = session.id;

		this.arrdepsets = new Collection();
		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(`Ready; loaded ${this.arrdepsets.size} ADS`);
				res();
			});
		});
	}

	get(id: string) {
		return this.arrdepsets.get(id);
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.arrdepsets.map((s) => s.fullMetadata());
	}

	async create(
		resource: ArrDepSet | ArrDepSetOptions,
		actor?: User
	): Promise<ArrDepSet> {
		actor && User.checkPermission(actor, "manage timetables", this.realm);

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

export default ADSManager;
