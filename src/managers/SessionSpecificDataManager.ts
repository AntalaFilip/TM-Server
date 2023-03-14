import Collection from "@discordjs/collection";
import { ForbiddenError } from "apollo-server-core";
import TMLogger from "../helpers/logger";
import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import Realm from "../types/Realm";
import Resource from "../types/Resource";
import { SessionSpecificResourceData } from "../types/SessionSpecificResourceData";
import User from "../types/User";
import BaseManager from "./BaseManager";
import { ResourceData } from "./ResourceManager";
import { ResourceDataType, SessionManager } from "./SessionManager";

abstract class SessionSpecificDataManager<R extends Resource>
	extends BaseManager
	implements ResourceData<SessionManager>
{
	public override readonly logger: TMLogger;
	public readonly ready: Promise<void>;
	public readonly data: Collection<string, ResourceDataType<R>>;
	public readonly sessionManager: SessionManager;
	public readonly resource: R;

	constructor(realm: Realm, resource: R) {
		super(
			`${resource.type}:${resource.id}:sessiondata`,
			realm.ionsp.server,
			realm.client
		);

		this.logger = new TMLogger(
			`${resource.type.toUpperCase()}:${realm.id}:${
				resource.id
			}:sessiondata`,
			`${resource.type.toUpperCase()}:${realm.shortId}:${
				resource.shortId
			}:sessiondata`
		);
		this.resource = resource;
		this.data = new Collection();

		this.sessionManager = realm.sessionManager;

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.data.size} instances of session-specific resources`
				);
				res();
			});
		});
	}

	get(id: string) {
		return this.data.get(id);
	}

	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}

	getAll() {
		return this.data.map((d) => d.fullMetadata());
	}

	async fromResourceIdentifier(
		fullId: string
	): Promise<SessionSpecificResourceData | undefined> {
		if (!this.db.redis.hexists(this.id, fullId)) return;

		const raw = await this.db.redis.hget(this.id, fullId);
		if (!raw) return;
		const data = JSON.parse(raw) as SessionSpecificResourceDataOptions;
		return await this.create(data);
	}

	async create(
		resource: SessionSpecificResourceDataOptions,
		actor?: User | undefined
	): Promise<SessionSpecificResourceData> {
		if (
			actor &&
			!actor.hasPermission(`manage sessions`, this.resource.realm)
		)
			throw new ForbiddenError("No permission!", {
				tmCode: `ENOPERM`,
				permission: `manage sessions`,
			});

		resource = this.instantiate(resource, this.resource);

		if (!(resource instanceof SessionSpecificResourceData))
			throw new Error(`something went wrong`);

		if (this.data.has(resource.id)) {
			throw new Error(`This session-specific data is already created!`);
		}

		this.data.set(resource.id, resource as ResourceDataType<R>);
		await this.resource.save();
		return resource;
	}

	abstract instantiate(
		opts: SessionSpecificResourceDataOptions,
		resource: R
	): SessionSpecificResourceData;

	protected async createAllFromStore() {
		const allSessionData = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allSessionData);
		for (const r of arr) {
			try {
				const v = JSON.parse(
					r[1]
				) as SessionSpecificResourceDataOptions;
				await this.create(v);
			} catch {
				this.logger.warn(`Malformed session-specific data @ ${r[0]}`);
			}
		}
	}

	key(name: string): string {
		return `${this.id}:${name}`;
	}
}
export { SessionSpecificDataManager };
