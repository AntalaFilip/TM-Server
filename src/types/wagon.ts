import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import { SessionSpecificDataManager } from "../managers/SessionSpecificDataManager";
import Movable, { MovableOptions } from "./Movable";
import { SessionSpecificMovableData } from "./SessionSpecificMovableData";
import Train from "./Train";
import User from "./User";

type WagonType = keyof typeof WagonTypes;
const WagonTypes = {
	PASSENGER: 1 << 1,
	CARGO: 1 << 2,
};

interface WagonOptions extends MovableOptions {
	wagonType: WagonType;
}

function checkWagonTypeValidity(toCheck: unknown): toCheck is WagonType {
	return (
		typeof toCheck === "string" && Object.keys(WagonTypes).includes(toCheck)
	);
}

class SessionSpecificWagonData extends SessionSpecificMovableData<Wagon> {
	constructor(opts: SessionSpecificResourceDataOptions, resource: Wagon) {
		super("sessionspecific-wagon", opts, resource);
	}
	metadata(): SessionSpecificResourceDataOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			realmId: this.realmId,
			sessionId: this.sessionId,
		};
	}
	publicMetadata() {
		return this.metadata();
	}
	fullMetadata() {
		return this.metadata();
	}
	modify(data: Record<string, unknown>, actor: User) {
		return this._modify(data, actor);
	}

	public get currentTrain(): Train | undefined {
		return this.realm.trainManager.trains.find((t) =>
			Boolean(
				t.sessionData
					.get(this.sessionId)
					?.trainSets.find((s) =>
						s.components.includes(this.resource)
					)
			)
		);
	}
}

class SessionSpecificWagonDataManager extends SessionSpecificDataManager<Wagon> {
	instantiate(
		opts: SessionSpecificResourceDataOptions,
		resource: Wagon
	): SessionSpecificWagonData {
		return new SessionSpecificWagonData(opts, resource);
	}
}

class Wagon extends Movable {
	private _wagonType: WagonType;
	/** Type of the current wagon; eg. passenger/cargo */
	public get wagonType() {
		return this._wagonType;
	}
	private set wagonType(type: WagonType) {
		this._wagonType = type;
		this.propertyChange("wagonType", this.wagonType);
	}

	public sessionData: SessionSpecificWagonDataManager;

	constructor(options: WagonOptions) {
		super("WAGON", options);

		this._wagonType = options.wagonType;
		this.sessionData = new SessionSpecificWagonDataManager(
			this.realm,
			this
		);
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
			realmId: this.realmId,
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
		if (!actor.hasPermission("manage movables", this.realm))
			throw new Error(`No permission`);
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
export {
	WagonOptions,
	WagonType,
	checkWagonTypeValidity,
	WagonTypes,
	SessionSpecificWagonData,
};
