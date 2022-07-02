import Movable, { MovableOptions } from "./movable";
import User from "./user";

type WagonType = 'passenger' | 'cargo';

interface WagonOptions extends MovableOptions {
	wagonType: WagonType,
}

function checkWagonTypeValidity(toCheck: unknown): toCheck is WagonType {
	return toCheck === 'passenger' || toCheck === 'cargo';
}


class Wagon extends Movable {
	private _wagonType: WagonType;
	/** Type of the current wagon; eg. passenger/cargo */
	public get wagonType() { return this._wagonType; }
	private set wagonType(type: WagonType) {
		this._wagonType = type;
		this.propertyChange('wagonType', this.wagonType);
	}

	constructor(options: WagonOptions) {
		super('wagon', options);

		this._wagonType = options.wagonType;
	}

	metadata(): WagonOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,
			wagonType: this.wagonType,
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
		if (checkWagonTypeValidity(data.wagonType)) {
			this.wagonType = data.wagonType;
			modified = true;
		}

		const mdf = this._modify(data, actor);

		if (!modified && !mdf) return false;

		return true;
	}

	static is(movable: Movable): movable is Wagon {
		return movable instanceof this;
	}
}

export default Wagon;
export { WagonOptions, WagonType };