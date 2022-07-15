import TMLogger from "../helpers/logger";
import Realm from "../types/realm";
import Resource, { ResourceOptions } from "../types/resource";
import User from "../types/user";
import BaseManager from "./BaseManager";

const managers = new Map<string, ResourceManager>();

interface ResourceData {
	fromResourceIdentifier(fullId: string): Resource | Promise<Resource>;
	create(resource: Resource | ResourceOptions): Resource | Promise<Resource>;
	getOne(id: string): ResourceOptions;
	getAll(): ResourceOptions[];
	get(id: string): Resource;
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
		return managers.get(id);
	}

	abstract fromResourceIdentifier(
		fullId: string
	): Resource | Promise<Resource>;

	abstract get(id: string): Resource;

	abstract getOne(id: string): ResourceOptions;
	abstract getAll(): ResourceOptions[];

	abstract create(
		resource: Resource | ResourceOptions,
		actor?: User
	): Resource | Promise<Resource>;

	key(name: string): string {
		return `${this.id}:${name}`;
	}
}

export default ResourceManager;
export { ResourceData };
