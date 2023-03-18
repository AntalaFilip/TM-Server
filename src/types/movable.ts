import {
	MovableManager,
	Resource,
	ResourceOptions,
	Session,
	StationLink,
	StationTrackLink,
	TMError,
	Train,
	User,
} from "../internal";

type MovableLocation = {
	stationLink: StationLink;
	trackLink?: StationTrackLink;
};

type MovableLocationMeta = {
	stationLinkId: string;
	trackLinkId?: string;
};

function checkMovableLocationMetaValidity(
	toCheck: Record<string, unknown>
): toCheck is MovableLocationMeta {
	return (
		typeof toCheck === "undefined" ||
		(typeof toCheck.stationId === "string" &&
			(!toCheck.trackId || typeof toCheck.trackId === "string"))
	);
}

function checkMovableLocationMetaExistence(
	toCheck: Record<string, unknown>,
	realm: Session
): toCheck is MovableLocation {
	return (
		checkMovableLocationMetaValidity(toCheck) &&
		toCheck !== undefined &&
		Boolean(realm.client.stationManager.get(toCheck.stationLinkId)) &&
		(!toCheck.trackLinkId ||
			Boolean(
				realm.client.stationManager
					.get(toCheck.stationLinkId)
					?.tracks.find((t) => t.id === toCheck.trackLinkId)
			))
	);
}

type MovableType = "WAGON" | "LOCOMOTIVE";

type MovableLinkType = "wagonlink" | "locomotivelink";

interface MovableOptions extends ResourceOptions<MovableManager> {
	maxSpeed?: number;
	length?: number;
	couplerType: string;
	model: string;
	name?: string;
	type: MovableType;
	ownerId?: string;
}

interface MovableLinkOptions extends ResourceOptions {
	currentLocation?: MovableLocationMeta;
	movableId: string;
	type: MovableLinkType;
}

abstract class Movable extends Resource<MovableManager> {
	public override readonly type: MovableType;

	private _model: string;
	/** The model ID of the object */
	public get model() {
		return this._model;
	}
	private set model(model: string) {
		this._model = model;
		this.propertyChange("model", this.model);
	}

	private _maxSpeed?: number;
	/** Maximum allowed speed for this object in KM/h */
	public get maxSpeed() {
		return this._maxSpeed;
	}
	private set maxSpeed(speed: number | undefined) {
		this._maxSpeed = speed;
		this.propertyChange("maxSpeed", this.maxSpeed);
	}

	private _length?: number;
	/** Length of the movable object in CM */
	public get length() {
		return this._length;
	}
	private set length(length: number | undefined) {
		this._length = length;
		this.propertyChange("length", this.length);
	}

	private _couplerType: string;
	/** Type of the coupler used */
	public get couplerType() {
		return this._couplerType;
	}
	private set couplerType(type: string) {
		this._couplerType = type;
		this.propertyChange("couplerType", this.couplerType);
	}

	private _name?: string;
	public get name() {
		return this._name;
	}
	public set name(name: string | undefined) {
		this._name = name;
		this.propertyChange("name", this.name);
	}

	private _ownerId?: string;
	public get ownerId() {
		return this._ownerId;
	}
	private set ownerId(id: string | undefined) {
		this._ownerId = id;
		this.propertyChange("ownerId", id);
	}
	public get owner(): User | undefined {
		return this.ownerId
			? this.manager.client.userManager.get(this.ownerId)
			: undefined;
	}

	constructor(type: MovableType, options: MovableOptions) {
		super(type, options);
		this.type = options.type;

		this._model = options.model;
		this._maxSpeed = options.maxSpeed;
		this._length = options.length;
		this._couplerType = options.couplerType;
		this._ownerId = options.ownerId;

		this._name = options.name;
	}

	_modify(data: Record<string, unknown>, actor: User) {
		User.checkPermission(actor, "manage movables");
		let modified = false;

		// TODO: auditing

		if (typeof data.name === "string") {
			this.name = data.name;
			modified = true;
		}
		if (typeof data.model === "string") {
			this.model = data.model;
			modified = true;
		}
		if (typeof data.maxSpeed === "number") {
			this.maxSpeed = data.maxSpeed;
			modified = true;
		}
		if (typeof data.length === "number") {
			this.length = data.length;
			modified = true;
		}
		if (typeof data.couplerType === "string") {
			this.couplerType = data.couplerType;
			modified = true;
		}

		if (!modified) return false;

		return true;
	}

	abstract override metadata(): MovableOptions;

	override async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);
		return true;
	}
}

abstract class MovableLink extends Resource {
	public override readonly type: MovableLinkType;
	public readonly movableId: string;
	public get movable() {
		const m = this.session.client.movableManager.get(this.movableId);
		if (!m) throw new TMError(`EINTERNAL`);
		return m;
	}

	private _currentLocation?: MovableLocation;
	/** The Station in which the object is currently located */
	public get currentLocation() {
		return this._currentLocation;
	}
	private set currentLocation(location: MovableLocation | undefined) {
		// there can't be a track without a station as tracks are tied to stations :)
		if (location && !location.stationLink && location.trackLink)
			location.trackLink = undefined;

		this._currentLocation = location;
		this.propertyChange("currentLocation", this.currentLocation);
	}

	abstract currentTrain?: Train;

	constructor(type: MovableLinkType, options: MovableLinkOptions) {
		super(type, options);
		this.type = options.type;

		this.movableId = options.movableId;

		const curSt =
			options.currentLocation &&
			this.session.stationLinkManager.get(
				options.currentLocation.stationLinkId
			);
		this._currentLocation = curSt &&
			options.currentLocation && {
				stationLink: curSt,
				trackLink: options.currentLocation.trackLinkId
					? curSt.trackLinks.get(options.currentLocation.trackLinkId)
					: undefined,
			};
	}

	override async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);
		return true;
	}
}

export {
	Movable,
	MovableOptions,
	MovableLocation,
	checkMovableLocationMetaExistence,
	checkMovableLocationMetaValidity,
	MovableLocationMeta,
	MovableLink,
	MovableLinkOptions,
	MovableLinkType,
};
