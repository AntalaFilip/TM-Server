import Realm from "../types/realm";
import BaseManager from "./BaseManager";

const managers = new Map<string, ResourceManager>();


abstract class ResourceManager extends BaseManager {
	readonly realm: Realm;
	readonly type: string;

	constructor(realm: Realm, type: string) {
		super(`${realm.id}:${type}`, realm.ionsp.server);
		this.realm = realm;
		this.type = type;

	}

	static get(id: string): ResourceManager {
		return managers.get(id);
	}

	abstract save(...extra: any[]): boolean | Promise<boolean>
	
	key(name: string): string {
		return `${this.id}:${name}`
	}
};

export default ResourceManager;