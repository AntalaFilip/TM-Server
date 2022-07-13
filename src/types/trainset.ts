import Movable from "./movable";
import Resource, { ResourceOptions } from "./resource";
import User from "./user";

interface TrainSetOptions extends ResourceOptions {
	name: string;
	components: Movable[];
}

interface TrainSetOptionsMetadata extends ResourceOptions {
	name: string;
	componentIds: string[];
}

class TrainSet extends Resource {
	private _name: string;
	public get name() {
		return this._name;
	}
	private set name(name: string) {
		this._name = name;
	}

	public readonly components: Movable[];

	constructor(options: TrainSetOptions) {
		super("trainset", options);

		this._name = options.name;
		this.components = options.components;
	}

	async newComponents(components: Movable[], noSave = false) {
		this.components.length = 0;
		this.components.push(...components);

		if (!noSave) await this.save();
	}

	async modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage trains", this.realm))
			throw new Error(`No permission`);
		let modified = false;

		// TODO: auditing

		if (typeof data.name === "string") {
			this.name = data.name;
			modified = true;
		}
		if (
			Array.isArray(data.components) &&
			data.components.every((c) => typeof c === "string")
		) {
			const components = data.components
				.map((c) => this.realm.movableManager.get(c))
				.filter((c) => c instanceof Movable);
			if (components.length === data.components.length) {
				await this.newComponents(components);
				modified = true;
			}
		}

		if (!modified) return false;
		return true;
	}

	metadata(): TrainSetOptionsMetadata {
		return {
			managerId: this.managerId,
			realmId: this.realmId,
			id: this.id,
			name: this.name,
			componentIds: this.components.map((c) => c.id),
		};
	}
	publicMetadata() {
		return {
			...this.metadata(),
		};
	}
	fullMetadata() {
		return {
			...this.metadata(),
			components: this.components.map((m) => m.publicMetadata()),
		};
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);
		return true;
	}
}

export default TrainSet;
export { TrainSetOptions };
