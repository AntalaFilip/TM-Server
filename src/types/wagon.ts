import Movable, { MovableOptions } from "./movable";
import Train from "./train";
import User from "./user";

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

	constructor(options: WagonOptions) {
		super("WAGON", options);

		this._wagonType = options.wagonType;
	}

	public get currentTrain(): Train {
		return this.realm.trainManager.trains.find((t) =>
			Boolean(t.trainSets.find((s) => s.components.includes(this)))
		);
	}

	metadata(): WagonOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,
			wagonType: this.wagonType,
			currentLocation: this.currentLocation
				? {
						stationId: this.currentLocation?.station?.id,
						trackId: this.currentLocation?.track?.id,
				  }
				: null,
			length: this.length,
			maxSpeed: this.maxSpeed,
			name: this.name,
			id: this.id,
			realmId: this.realmId,
			managerId: this.managerId,
			type: this.type,
		};
	}
	publicMetadata() {
		return {
			...this.metadata(),
		};
	}
	fullMetadata() {
		return {
			...this.metadata(),
			currentLocation:
				this.currentLocation &&
				Object.fromEntries(
					Object.entries(this.currentLocation).map(([k, v]) => [
						k,
						v.publicMetadata(),
					])
				),
		};
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
export { WagonOptions, WagonType, checkWagonTypeValidity, WagonTypes };
