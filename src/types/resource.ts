import { newUUID } from "../helpers/id";
import BaseManager from "../managers/BaseManager";
import ResourceManager from "../managers/ResourceManager";
import SessionManager from "../managers/SessionManager";
import { SessionSpecificDataManager } from "../managers/SessionSpecificDataManager";
import Realm from "./Realm";
import User from "./User";

interface ResourceOptions<M extends ManagerType = ResourceManager> {
	id: string;
	realmId: RealmIdType<M>;
	managerId: M extends null ? null : string;
}

type ResourceConstructorOptions<M extends ManagerType = ResourceManager> = Omit<
	ResourceOptions<M>,
	"id"
> & { id?: string };

type ManagerType = ResourceManager | BaseManager | null;
type RealmType<M> = M extends ResourceManager<true>
	? Realm
	: M extends ResourceManager<false>
	? Realm
	: null;
type RealmIdType<M> = M extends ResourceManager ? string : null;
type SessionDataType<M, U> = U extends false
	? undefined
	: M extends ResourceManager
	? M extends SessionManager
		? undefined
		: SessionSpecificDataManager<Resource>
	: undefined;

export abstract class Resource<
	M extends ManagerType = ResourceManager,
	U extends boolean = true
> {
	public readonly id: string;
	public readonly shortId: string;
	public readonly realmId: RealmIdType<M>;
	public readonly type: string;

	public get realm(): RealmType<M> {
		if (this.manager instanceof ResourceManager)
			return this.manager.realm as RealmType<M>;
		else return null as RealmType<M>;
	}

	public readonly managerId: M extends null ? null : string;
	public get manager(): M {
		if (typeof this.managerId === "string") {
			const manager =
				ResourceManager.get(this.managerId) ??
				BaseManager.get(this.managerId);
			if (!manager) throw new Error("Bad manager");
			return manager as M;
		} else return null as M;
	}

	public abstract sessionData: SessionDataType<M, U>;

	constructor(type: string, options: ResourceConstructorOptions<M>) {
		this.id = options.id ?? newUUID();
		this.shortId = this.id.slice(this.id.length - 6);
		this.realmId = options.realmId;
		this.managerId = options.managerId;
		this.type = type;
	}

	/**
	 * Sends a `propertyChange` event to either the realm namespace, or globally, if no namespace exists.
	 * @param prop The property name
	 * @param value The value of the property
	 * @param noSave Whether to skip saving the Resource
	 * @returns
	 */
	public propertyChange(prop: string, value: unknown, noSave = false) {
		if (!noSave) this.save();
		const i = this.realm?.ionsp ?? this.manager?.client.io;
		if (!i) return false;
		return i.emit("propertyChange", this.id, this.type, prop, value);
	}

	abstract modify(
		data: Record<string, unknown>,
		actor?: User
	): boolean | Promise<boolean>;
	abstract save(): boolean | Promise<boolean>;
	/** Returns metadata required to reconstruct the Resource */
	abstract metadata(): ResourceOptions<M>;
	/** Returns the metadata that can be made public in a JSON-ified form */
	abstract publicMetadata(): ResourceOptions<M>;
	/** Returns the required metadata for the GraphQL resolver */
	abstract fullMetadata(): ResourceOptions<M>;
}

export default Resource;
export type {
	ManagerType,
	RealmType,
	RealmIdType,
	ResourceConstructorOptions,
	SessionDataType,
	ResourceOptions,
};
