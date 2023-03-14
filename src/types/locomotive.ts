import { SessionSpecificMovableDataOptions } from "../interfaces/SessionSpecificMovableDataOptions";
import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import { SessionSpecificDataManager } from "../managers/SessionSpecificDataManager";
import Movable, { MovableOptions } from "./Movable";
import { SessionSpecificMovableData } from "./SessionSpecificMovableData";
import User from "./User";

type LocomotiveOptions = MovableOptions;
interface SessionSpecificLocomotiveDataOptions
	extends SessionSpecificMovableDataOptions {
	controller?: User;
}

class SessionSpecificLocomotiveData extends SessionSpecificMovableData<Locomotive> {
	private _controller?: User;
	public get controller() {
		return this._controller;
	}
	private set controller(ctl: User | undefined) {
		this._controller = ctl;
		const trueTimestamp = this.session.timeManager.trueMs;
		this.instanceManager.db.redis.xadd(
			this.instanceManager.key(`${this.id}:controllers`),
			"*",
			"id",
			ctl?.id ?? "",
			"type",
			ctl?.type ?? "",
			"time",
			trueTimestamp
		);
		this.propertyChange(`controller`, ctl, true);
	}

	public get currentTrain() {
		return this.realm.trainManager.trains.find(
			(t) =>
				t.sessionData.get(this.sessionId)?.locomotive === this.resource
		);
	}

	constructor(
		options: SessionSpecificLocomotiveDataOptions,
		resource: Locomotive
	) {
		super(`sessionspecific-locomotive`, options, resource);

		this._controller = options.controller;
	}

	modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage movables", this.realm))
			throw new Error(`No permission`);
		let modified = false;

		// TODO: auditing
		if (
			typeof data.controllerId === "string" &&
			this.realm.client.userManager.get(data.controllerId)
		) {
			this.controller = this.realm.client.userManager.get(
				data.controllerId
			);
			modified = true;
		}

		const mdf = this._modify(data, actor);

		if (!modified && !mdf) return false;

		return true;
	}

	publicMetadata(): SessionSpecificMovableDataOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			realmId: this.realmId,
			sessionId: this.sessionId,
			currentLocation: this.currentLocation && {
				stationId: this.currentLocation?.station?.id,
				trackId: this.currentLocation?.track?.id,
			},
		};
	}

	metadata() {
		return this.publicMetadata();
	}

	fullMetadata() {
		return this.metadata();
	}
}

class SessionSpecificLocomotiveDataManager extends SessionSpecificDataManager<Locomotive> {
	instantiate(
		opts: SessionSpecificResourceDataOptions,
		resource: Locomotive
	): SessionSpecificLocomotiveData {
		return new SessionSpecificLocomotiveData(opts, resource);
	}
	protected override async createAllFromStore() {
		const allLocomotiveData = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allLocomotiveData);
		for (const r of arr) {
			try {
				const v = JSON.parse(
					r[1]
				) as SessionSpecificLocomotiveDataOptions;
				const controllersd = await this.db.redis.xrevrange(
					this.key(`${v.id}:controllers`),
					"+",
					"-",
					"COUNT",
					1
				);
				if (controllersd[0] && controllersd[0][1]) {
					const id = controllersd[0][1][1];
					const type = controllersd[0][1][3];
					if (type === "user" && id) {
						v.controller = this.client.userManager.get(id);
					}
				}
			} catch (err) {
				this.logger.warn(
					`Malformed session-specific locomotive data @ ${r[0]}`
				);
			}
		}
	}
}

class Locomotive extends Movable {
	constructor(options: LocomotiveOptions) {
		super("LOCOMOTIVE", options);
		this.sessionData = new SessionSpecificLocomotiveDataManager(
			this.realm,
			this
		);
	}

	public sessionData: SessionSpecificLocomotiveDataManager;

	metadata(): LocomotiveOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,

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
		return this._modify(data, actor);
	}

	static is(movable: Movable): movable is Locomotive {
		return movable instanceof this;
	}
}

export default Locomotive;
export {
	SessionSpecificLocomotiveData,
	SessionSpecificLocomotiveDataManager,
	SessionSpecificLocomotiveDataOptions,
};
