import { Resource, ResourceOptions, User, UserLink } from "../internal";
import { MovableLink } from "./movable";

interface TrainSetOptions extends ResourceOptions {
	name: string;
	components: MovableLink[];
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
		this.propertyChange("name", this.name);
	}

	public readonly components: MovableLink[];

	constructor(options: TrainSetOptions) {
		super("trainset", options);

		this._name = options.name;
		this.components = options.components;
	}

	async newComponents(components: MovableLink[], noSave = false) {
		this.components.length = 0;
		this.components.push(...components);

		return this.propertyChange(
			"componentIds",
			this.components.map((c) => c.id),
			noSave
		);
	}

	async modify(data: Record<string, unknown>, actor: UserLink) {
		User.checkPermission(actor.user, "manage trains", this.session);
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
				.map((c) => this.session.movableLinkManager.get(c))
				.filter((c) => c instanceof MovableLink) as MovableLink[];
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
			sessionId: this.sessionId,
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

export { TrainSet, TrainSetOptions, TrainSetOptionsMetadata };
