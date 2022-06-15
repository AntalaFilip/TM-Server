import Movable, { MovableOptions } from "./movable";

class Locomotive extends Movable {
	metadata(): MovableOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,
			currentLocationId: this.currentLocation?.id,
			length: this.length,
			maxSpeed: this.maxSpeed,
			name: this.name,
		};
	}
}

export default Locomotive;