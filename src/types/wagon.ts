import Movable, { MovableOptions } from "./movable";

interface WagonOptions extends MovableOptions {
	wagonType: string,
}

class Wagon extends Movable {
	private _wagonType: 'passenger' | 'cargo';
	/** Type of the current wagon; eg. passenger/cargo */
	public get wagonType() { return this._wagonType };
	private set wagonType(type: 'passenger' | 'cargo') { this._wagonType = type };

	metadata(): WagonOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,
			wagonType: this.wagonType,
			currentLocationId: this.currentLocation?.id,
			length: this.length,
			maxSpeed: this.maxSpeed,
			name: this.name,
		};
	}
};

export default Wagon;