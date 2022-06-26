import Realm from "../types/realm";
import Resource, { ResourceOptions } from "../types/resource";
import BaseManager from "./BaseManager";

const managers = new Map<string, ResourceManager>();

interface ResourceData {
	fromResourceIdentifier(fullId: string): Resource | Promise<Resource>;
	create(resource: Resource | ResourceOptions): Resource | Promise<Resource>;
}

abstract class ResourceManager extends BaseManager implements ResourceData {
	readonly realm: Realm;
	readonly type: string;

	constructor(realm: Realm, type: string) {
		super(`realms:${realm.id}:${type}`, realm.ionsp.server, realm.client);
		this.realm = realm;
		this.type = type;

		managers.set(this.id, this);
	}

	static get(id: string): ResourceManager {
		return managers.get(id);
	}

	abstract fromResourceIdentifier(fullId: string): Resource | Promise<Resource>;

	abstract get(id: string): Resource

	abstract create(resource: Resource | ResourceOptions): Resource | Promise<Resource>;

	key(name: string): string {
		return `${this.id}:${name}`
	}
}

export default ResourceManager;
export { ResourceData };