import Resource, { ResourceOptions } from "./resource";
import Station from "./station";
import StationTrack from "./track";
import User from "./user";

type MovableLocation = {
	station: Station,
	track?: StationTrack,
};

type MovableLocationMeta = {
	stationId: string,
	trackId?: string,
};

type MovableType = 'wagon' | 'locomotive';

interface MovableOptions extends ResourceOptions {
	maxSpeed?: number,
	length?: number,
	couplerType: string,
	currentLocation?: MovableLocationMeta,
	model: string,
	name?: string,
	type?: MovableType,
}

abstract class Movable extends Resource {
	public readonly id: string;
	public readonly realmId: string;

	public override readonly type: MovableType;

	private _model: string;
	/** The model ID of the object */
	public get model() { return this._model; }
	private set model(model: string) {
		this._model = model;
		this.propertyChange('model', this.model);
	}

	private _maxSpeed?: number;
	/** Maximum allowed speed for this object in KM/h */
	public get maxSpeed() { return this._maxSpeed; }
	private set maxSpeed(speed: number) {
		this._maxSpeed = speed;
		this.propertyChange('maxSpeed', this.maxSpeed);
	}

	private _length?: number;
	/** Length of the movable object in CM */
	public get length() { return this._length; }
	private set length(length: number) {
		this._length = length;
		this.propertyChange('length', this.length);
	}

	private _couplerType: string;
	/** Type of the coupler used */
	public get couplerType() { return this._couplerType; }
	private set couplerType(type: string) {
		this._couplerType = type;
		this.propertyChange('couplerType', this.couplerType);
	}

	private _currentLocation?: MovableLocation;
	/** The Station in which the object is currently located */
	public get currentLocation() { return this._currentLocation; }
	private set currentLocation(location: MovableLocation) {
		this._currentLocation = location;
		this.propertyChange('currentLocation', this.currentLocation);
	}

	private _name: string;
	public get name() { return this._name; }
	public set name(name: string) {
		this._name = name;
		this.propertyChange('name', this.name);
	}

	/* private _currentStatus: number;
	public get currentStatus() { return this._currentStatus };
	private set currentStatus(status: number) { this._currentStatus = status }; */

	constructor(type: MovableType, options: MovableOptions) {
		super(type, options);

		this._model = options.model;
		this._maxSpeed = options.maxSpeed;
		this._length = options.length;
		this._couplerType = options.couplerType;
		// TODO: do location cool things
		this._currentLocation = null;

		this._name = options.name;
	}

	_modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission('manage movables', this.realm)) throw new Error(`No permission`);
		let modified = false;

		// TODO: auditing

		if (typeof data.name === 'string') {
			this.name = data.name;
			modified = true;
		}
		if (typeof data.model === 'string') {
			this.model = data.model;
			modified = true;
		}
		if (typeof data.maxSpeed === 'number') {
			this.maxSpeed = data.maxSpeed;
			modified = true;
		}
		if (typeof data.length === 'number') {
			this.length = data.length;
			modified = true;
		}
		if (typeof data.couplerType === 'string') {
			this.couplerType = data.couplerType;
			modified = true;
		}
		// TODO: currentLocation changes


		if (!modified) return false;

		return true;
	}

	abstract metadata(): MovableOptions

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.managerId, [this.id, JSON.stringify(this.metadata())]);
		return true;
	}
}

export default Movable;
export { MovableOptions, MovableLocation };