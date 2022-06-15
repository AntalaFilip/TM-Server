import Station from "./station";

/* const MovableStatuses: {
	'MISSING': 0,
	'MOVING': 1,
	'ARRIVED': 2,
	'READY': 3,
	'LEAVING': 4,
}; */

interface MovableOptions {
	maxSpeed?: number,
	length?: number,
	couplerType: string,
	currentLocationId?: string,
	model: string,
	name?: string,
}

abstract class Movable {
	public readonly id: string;

	private _model: string;
	/** The model ID of the object */
	public get model() { return this._model };
	private set model(model: string) { this._model = model };

	private _maxSpeed?: number;
	/** Maximum allowed speed for this object in KM/h */
	public get maxSpeed() { return this._maxSpeed };
	private set maxSpeed(speed: number) { this._maxSpeed = speed };

	private _length?: number;
	/** Length of the movable object in CM */
	public get length() { return this._length };
	private set length(length: number) { this._length = length };

	private _couplerType: string;
	/** Type of the coupler used */
	public get couplerType() { return this._couplerType };
	private set couplerType(type: string) { this._couplerType = type };

	private _currentLocation?: Station;
	/** The Station in which the object is currently located */
	public get currentLocation() { return this._currentLocation };
	private set currentLocation(location: Station) { this._currentLocation = location };

	public name: string;

	/* private _currentStatus: number;
	public get currentStatus() { return this._currentStatus };
	private set currentStatus(status: number) { this._currentStatus = status }; */

	constructor(id: string, options: MovableOptions) {
		this.id = id;
		
		this._model = options.model;
		this._maxSpeed = options.maxSpeed;
		this._length = options.length;
		this._couplerType = options.couplerType;
		this._currentLocation = null; // TODO: do location cool things

		this.name = options.name;
	}

	abstract metadata(): MovableOptions
}

export default Movable;
export { MovableOptions };