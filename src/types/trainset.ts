import Movable, { MovableOptions } from "./movable";
import Resource, { ResourceOptions } from "./resource";

interface TrainSetOptions extends ResourceOptions {
	name: string,
	components: Movable[]
}

interface TrainSetOptionsMetadata extends ResourceOptions {
	name: string,
	components: string[]
}

class TrainSet extends Resource {
	private _name: string;
	public get name() { return this._name; }
	private set name(name: string) { this._name = name; }

	public readonly components: Movable[];

	constructor(options: TrainSetOptions) {
		super('trainset', options);

		this._name = options.name;
		this.components = options.components;
	}

	async newComponents(components: Movable[], noSave = false) {
		this.components.length = 0;
		this.components.push(...components);

		if (!noSave) await this.save();
	}

	metadata(): TrainSetOptionsMetadata {
		return {
			managerId: this.managerId,
			realmId: this.realmId,
			id: this.id,
			name: this.name,
			components: this.components.map(c => c.id),
		};
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.managerId, [this.id, JSON.stringify(this.metadata())]);
		return true;
	}
}

export default TrainSet;
export { TrainSetOptions };