import Movable, { MovableOptions } from "./movable";
import User from "./user";

interface LocomotiveOptions extends MovableOptions {
	controller?: User,
}

class Locomotive extends Movable {
	constructor(options: LocomotiveOptions) {
		super('locomotive', options);

		// TODO: sanity check
		this._controller = options.controller;
	}

	private _controller: User;
	public get controller() { return this._controller; }
	private set controller(ctl: User) {
		this._controller = ctl;
		const trueTimestamp = this.manager.realm.timeManager.trueMs;
		this.manager.db.redis.xadd(this.manager.key(`${this.id}:controllers`), "id", ctl?.id, "type", ctl?.type, "time", trueTimestamp);
		this.propertyChange(`controller`, ctl, true);
	}

	metadata(): LocomotiveOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,
			currentLocation: this.currentLocation ? { stationId: this.currentLocation?.station?.id, trackId: this.currentLocation?.track?.id } : null,
			length: this.length,
			maxSpeed: this.maxSpeed,
			name: this.name,
			id: this.id,
			realmId: this.realmId,
			managerId: this.managerId,
			type: this.type,
		};
	}

	modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission('manage movables', this.realm)) throw new Error(`No permission`);
		let modified = false;

		// TODO: auditing
		if (typeof data.controllerId === 'string' && this.realm.client.userManager.get(data.controllerId)) {
			this.controller = this.realm.client.userManager.get(data.controllerId);
			modified = true;
		}

		const mdf = this._modify(data, actor);

		if (!modified && !mdf) return false;

		return true;
	}

	static is(movable: Movable): movable is Locomotive {
		return movable instanceof this;
	}
}

export default Locomotive;