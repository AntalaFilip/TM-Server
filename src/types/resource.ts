import {
	BaseManager,
	newUUID,
	Session,
	SessionResourceManager,
	User,
	UserLink,
} from "../internal";

interface ResourceOptions<M extends ManagerType = SessionResourceManager> {
	id: string;
	sessionId: SessionIdType<M>;
	managerId: M extends null ? null : string;
}

type ResourceContructorOptions<M extends ManagerType = SessionResourceManager> =
	Omit<ResourceOptions<M>, "id"> & { id?: string };

type ManagerType = SessionResourceManager | BaseManager | null;
type SessionType<M> = M extends SessionResourceManager ? Session : null;
type SessionIdType<M> = M extends SessionResourceManager ? string : null;
type UserType<M> = M extends SessionResourceManager ? UserLink : User;

abstract class Resource<M extends ManagerType = SessionResourceManager> {
	public readonly id: string;
	public readonly shortId: string;
	public readonly sessionId: SessionIdType<M>;
	public readonly type: string;

	public get session(): SessionType<M> {
		if (this.manager instanceof SessionResourceManager)
			return this.manager.session as SessionType<M>;
		else return null as SessionType<M>;
	}

	public readonly managerId: M extends null ? null : string;
	public get manager(): M {
		if (typeof this.managerId === "string") {
			const manager =
				SessionResourceManager.get(this.managerId, false) ??
				BaseManager.get(this.managerId);
			if (!manager) throw new Error("Bad manager");
			return manager as M;
		} else return null as M;
	}

	constructor(type: string, options: ResourceContructorOptions<M>) {
		this.id = options.id ?? newUUID();
		this.shortId = this.id.slice(this.id.length - 6);
		this.sessionId = options.sessionId;
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
	protected propertyChange(prop: string, value: unknown, noSave = false) {
		if (!noSave) this.save();
		const i = this.session?.ionsp ?? this.manager?.client.io;
		if (!i) return false;
		return i.emit("propertyChange", this.id, this.type, prop, value);
	}

	abstract modify(
		data: Record<string, unknown>,
		actor?: UserType<M>
	): boolean | Promise<boolean>;
	abstract save(): boolean | Promise<boolean>;
	/** Returns metadata required to reconstruct the Resource */
	abstract metadata(): ResourceOptions<M>;
	/** Returns the metadata that can be made public */
	abstract publicMetadata(): ResourceOptions<M>;
	/** Returns the required metadata for the GraphQL resolver */
	abstract fullMetadata(): ResourceOptions<M>;
}

export type {
	ManagerType,
	SessionType,
	SessionIdType,
	ResourceContructorOptions,
};
export { Resource, ResourceOptions };
