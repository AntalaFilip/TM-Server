import TMLogger from "../helpers/logger";
import Realm from "../types/realm";
import Resource, { ManagerType, ResourceContructorOptions, ResourceOptions } from "../types/resource";
import User from "../types/user";
import BaseManager from "./BaseManager";

const managers = new Map<string, ResourceManager>();

interface ResourceData<M extends ManagerType = ResourceManager> {
	fromResourceIdentifier(fullId: string): Resource<M> | undefined |  Promise<Resource<M> | undefined>;
	create(resource: Resource<M> | ResourceContructorOptions<M>): Resource<M> |  Promise<Resource<M>>;
	getOne(id: string): ResourceOptions<M> | undefined;
	getAll(): ResourceOptions<M>[];
	get(id: string): Resource<M> | undefined;
}

abstract class ResourceManager extends BaseManager implements ResourceData {
	readonly realm: Realm;
	readonly type: string;
	override readonly logger: TMLogger;

	constructor(realm: Realm, type: string) {
		super(`realms:${realm.id}:${type}`, realm.ionsp.server, realm.client);
		this.realm = realm;
		this.type = type;
		this.logger = new TMLogger(
			`${this.type.toUpperCase()}:${this.realm.id}`,
			`${this.type.toUpperCase()}:${this.realm.shortId}`
		);

		managers.set(this.id, this);
	}

	static get(id: string): ResourceManager {
		const manager = managers.get(id);
		if (!manager) throw new Error('Invalid manager');
		return manager;
	}

	abstract fromResourceIdentifier(
		fullId: string
	): Resource | undefined | Promise<Resource | undefined>;

	abstract get(id: string): Resource | undefined;

	abstract getOne(id: string): ResourceOptions | undefined;
	abstract getAll(): ResourceOptions[];

	abstract create(
		resource: Resource | ResourceContructorOptions,
		actor?: User
	): Resource | Promise<Resource>;

	key(name: string): string {
		return `${this.id}:${name}`;
	}
}

export default ResourceManager;
export { ResourceData };
