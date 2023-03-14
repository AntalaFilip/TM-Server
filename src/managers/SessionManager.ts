import Collection from "@discordjs/collection";
import { ForbiddenError } from "apollo-server-core";
import Locomotive, { SessionSpecificLocomotiveData } from "../types/Locomotive";
import Realm from "../types/Realm";
import Resource from "../types/Resource";
import Session, { SessionOptions } from "../types/Session";
import Station from "../types/Station";
import { SessionSpecificStationData } from "../types/SessionSpecificStationData";
import TMError from "../types/TMError";
import StationTrack from "../types/Track";
import { SessionSpecificStationTrackData } from "../types/SessionSpecificStationTrackData";
import Train, { SessionSpecificTrainData } from "../types/Train";
import User from "../types/User";
import ResourceManager from "./ResourceManager";
import { SessionSpecificResourceData } from "../types/SessionSpecificResourceData";

class SessionManager extends ResourceManager<false> {
	public readonly sessions: Collection<string, Session>;
	public readonly ready: Promise<void>;

	constructor(realm: Realm) {
		super(realm, `sessions`);

		this.sessions = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.sessions.size} sessions.`
				);
				res();
			});
		});
	}

	get(id: string): Session | undefined {
		return this.sessions.get(id);
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.sessions.map((tt) => tt.fullMetadata());
	}

	async fromResourceIdentifier(fullId: string): Promise<Session | undefined> {
		if (!(await this.db.redis.exists(fullId))) return;

		const sessionMeta = (await this.db.get(fullId)) as SessionOptions;

		return new Session(sessionMeta);
	}

	async create(
		resource: Session | SessionOptions,
		actor?: User
	): Promise<Session> {
		if (actor && !actor.hasPermission("manage sessions", this.realm))
			throw new ForbiddenError(`No permission!`, {
				tmCode: `ENOPERM`,
				permission: `manage sessions`,
			});

		if (!(resource instanceof Session)) {
			resource = new Session(resource);
		}
		if (!(resource instanceof Session)) throw new TMError("EINTERNAL");

		if (this.sessions.has(resource.id))
			throw new Error(`This Session is already created!`);

		this.sessions.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	private async createAllFromStore() {
		const allSessions = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allSessions);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as SessionOptions;
				await this.create(v);
			} catch {
				this.logger.warn(`Malformed session data @ ${r[0]}`);
			}
		}

		return true;
	}
}

type ResourceDataType<R extends Resource> = R extends Station
	? SessionSpecificStationData
	: R extends StationTrack
	? SessionSpecificStationTrackData
	: R extends Train
	? SessionSpecificTrainData
	: R extends Locomotive
	? SessionSpecificLocomotiveData
	: SessionSpecificResourceData;

export default SessionManager;
export { SessionManager, ResourceDataType };
