import { newUUID } from "../helpers/id";
import ResourceManager from "../managers/ResourceManager";
import User from "./user";

interface ResourceOptions {
	id?: string;
	realmId: string;
	managerId: string;
}

abstract class Resource {
	public readonly id: string;
	public readonly shortId: string;
	public readonly realmId: string;
	public readonly type: string;

	public get realm() {
		return this.manager.realm;
	}

	public readonly managerId: string;
	public get manager() {
		return ResourceManager.get(this.managerId);
	}

	constructor(type: string, options: ResourceOptions) {
		this.id = options.id ?? newUUID();
		this.shortId = this.id.slice(this.id.length - 6);
		this.realmId = options.realmId;
		this.managerId = options.managerId;
		this.type = type;
	}

	/**
	 * Sends all Sockets connected to the Realm namespace a `propertyChange` event and saves the Resource.
	 * @param prop The property name
	 * @param value The value of the property
	 * @param noSave Whether to skip saving the Resource
	 * @returns
	 */
	protected propertyChange(prop: string, value: unknown, noSave = false) {
		if (!noSave) this.save();
		return this.realm.ionsp.emit(
			"propertyChange",
			this.id,
			this.type,
			prop,
			value
		);
	}

	abstract modify(
		data: Record<string, unknown>,
		actor?: User
	): boolean | Promise<boolean>;
	abstract save(): boolean | Promise<boolean>;
	/** Returns metadata required to reconstruct the Resource */
	abstract metadata(): ResourceOptions;
	/** Returns the metadata that can be made public */
	abstract publicMetadata(): ResourceOptions;
	/** Returns the required metadata for the GraphQL resolver */
	abstract fullMetadata(): ResourceOptions;
}

export default Resource;
export { ResourceOptions };
