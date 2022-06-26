import Movable, { MovableOptions } from "./movable";

type WagonType = 'passenger' | 'cargo';

interface WagonOptions extends MovableOptions {
	wagonType: WagonType,
}

class Wagon extends Movable {
	private _wagonType: WagonType;
	/** Type of the current wagon; eg. passenger/cargo */
	public get wagonType() { return this._wagonType };
	private set wagonType(type: WagonType) {
		this._wagonType = type;
		this.propertyChange('wagonType', this.wagonType);
	};

	constructor(options: WagonOptions) {
		super('wagon', options);

		this._wagonType = options.wagonType;
	}

	metadata(): WagonOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,
			wagonType: this.wagonType,
			currentLocationId: this.currentLocation?.id,
			length: this.length,
			maxSpeed: this.maxSpeed,
			name: this.name,
			id: this.id,
			realmId: this.realmId,
			managerId: this.managerId,
			type: this.type,
		};
	}

	static is(movable: Movable): movable is Wagon {
		return movable instanceof this;
	}
};

export default Wagon;
export { WagonOptions, WagonType };