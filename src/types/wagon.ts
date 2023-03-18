import {
	Movable,
	MovableLink,
	MovableLinkOptions,
	MovableOptions,
	TMError,
	Train,
	User,
} from "../internal";

type WagonType = keyof typeof WagonTypes;
const WagonTypes = {
	PASSENGER: 1 << 1,
	CARGO: 1 << 2,
};

interface WagonOptions extends MovableOptions {
	wagonType: WagonType;
}

interface WagonLinkOptions extends MovableLinkOptions {
	wagonId: string;
}

function checkWagonTypeValidity(toCheck: unknown): toCheck is WagonType {
	return (
		typeof toCheck === "string" && Object.keys(WagonTypes).includes(toCheck)
	);
}

class Wagon extends Movable {
	public override readonly type = "WAGON";
	private _wagonType: WagonType;
	/** Type of the current wagon; eg. passenger/cargo */
	public get wagonType() {
		return this._wagonType;
	}
	private set wagonType(type: WagonType) {
		this._wagonType = type;
		this.propertyChange("wagonType", this.wagonType);
	}

	constructor(options: WagonOptions) {
		super("WAGON", options);

		this._wagonType = options.wagonType;
	}

	metadata(): WagonOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,
			wagonType: this.wagonType,
			length: this.length,
			maxSpeed: this.maxSpeed,
			name: this.name,
			id: this.id,
			sessionId: this.sessionId,
			managerId: this.managerId,
			type: this.type,
			ownerId: this.ownerId,
		};
	}
	publicMetadata() {
		return this.metadata();
	}
	fullMetadata() {
		return this.metadata();
	}

	modify(data: Record<string, unknown>, actor: User) {
		User.checkPermission(actor, "manage movables");
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

class WagonLink extends MovableLink {
	public override readonly type = "wagonlink";
	public readonly wagonId: string;
	public get wagon() {
		const w = this.session.client.movableManager.getWagon(this.wagonId);
		if (!w) throw new TMError(`EINTERNAL`);
		return w;
	}

	constructor(options: WagonLinkOptions) {
		super("wagonlink", options);

		this.wagonId = options.wagonId;
	}

	public get currentTrain(): Train | undefined {
		return this.session.trainManager.trains.find((t) =>
			Boolean(t.trainSets.find((s) => s.components.includes(this)))
		);
	}

	metadata(): WagonLinkOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			movableId: this.movableId,
			sessionId: this.sessionId,
			wagonId: this.wagonId,
			currentLocation: this.currentLocation && {
				stationLinkId: this.currentLocation.stationLink?.id,
				trackLinkId: this.currentLocation.trackLink?.id,
			},
			type: this.type,
		};
	}
	publicMetadata() {
		return this.metadata();
	}
	fullMetadata() {
		return this.metadata();
	}
	modify(): boolean {
		return false;
	}
}

export {
	Wagon,
	WagonOptions,
	WagonType,
	checkWagonTypeValidity,
	WagonTypes,
	WagonLink,
	WagonLinkOptions,
};
