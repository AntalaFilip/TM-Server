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
	public get controller() { return this._controller };
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
			currentLocationId: this.currentLocation?.id,
			length: this.length,
			maxSpeed: this.maxSpeed,
			name: this.name,
			id: this.id,
			realmId: this.realmId,
			managerId: this.managerId,
			type: this.type,
			controller: this.controller,
		};
	}

	static is(movable: Movable): movable is Locomotive {
		return movable instanceof this;
	}
}

export default Locomotive;