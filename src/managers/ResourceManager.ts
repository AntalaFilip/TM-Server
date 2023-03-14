import TMLogger from "../helpers/logger";
import Realm from "../types/Realm";
import Resource, {
	ManagerType,
	ResourceConstructorOptions,
	ResourceOptions,
} from "../types/Resource";
import User from "../types/User";
import BaseManager from "./BaseManager";

const managers = new Map<string, ResourceManager<boolean>>();

interface ResourceData<
	M extends ManagerType = ResourceManager,
	U extends boolean = true
> {
	fromResourceIdentifier(
		fullId: string
	): Resource<M, U> | undefined | Promise<Resource<M, U> | undefined>;
	create(
		resource: Resource<M> | ResourceConstructorOptions<M>
	): Resource<M, U> | Promise<Resource<M, U>>;
	getOne(id: string): ResourceOptions<M> | undefined;
	getAll(): ResourceOptions<M>[];
	get(id: string): Resource<M, U> | undefined;
}

abstract class ResourceManager<U extends boolean = true>
	extends BaseManager
	implements ResourceData<ResourceManager, U>
{
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
		if (!manager) throw new Error("Invalid manager");
		return manager;
	}

	abstract fromResourceIdentifier(
		fullId: string
	):
		| Resource<ResourceManager, U>
		| undefined
		| Promise<Resource<ResourceManager, U> | undefined>;

	abstract get(id: string): Resource<ResourceManager, U> | undefined;

	abstract getOne(id: string): ResourceOptions | undefined;
	abstract getAll(): ResourceOptions[];

	abstract create(
		resource: Resource | ResourceConstructorOptions,
		actor?: User
	): Resource<ResourceManager, U> | Promise<Resource<ResourceManager, U>>;

	key(name: string): string {
		return `${this.id}:${name}`;
	}
}

export default ResourceManager;
export { ResourceData };
