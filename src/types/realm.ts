import { Namespace as SIONamespace, Server as SIOServer } from "socket.io";
import Redis from "../helpers/redis";

interface RealmOptions {
	name: string,
	// TODO: owner: User,
	// TODO: time: RealmTimeOptions | RealmTimeID,
	ionsp?: SIONamespace,
	io: SIOServer,
	db?: Redis,
}

class Realm {
	public readonly id: string;

	private _name: string;
	public get name(): string { return this._name };
	private set name(name: string) { this._name = name; };

	public readonly ionsp: SIONamespace;
	public readonly db: Redis;

	constructor(id: string, options?: RealmOptions) {
		this.id = id;
		this.name = options?.name || id;
		this.ionsp = options?.ionsp ?? options.io.of(`/${this.id}`);
		this.db = options?.db ?? new Redis(this.id);
	}

	static get default(): Realm {
		return defRealm;
	}
}

const defRealm: Realm = new Realm('DEFAULT');


export default Realm;
export { RealmOptions };