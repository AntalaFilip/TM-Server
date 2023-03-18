import {
	Movable,
	MovableLink,
	MovableLinkOptions,
	MovableOptions,
	TMError,
	User,
	UserLink,
} from "../internal";

interface LocomotiveLinkOptions extends MovableLinkOptions {
	controllerId?: string;
	locomotiveId: string;
}

class Locomotive extends Movable {
	public override readonly type = "LOCOMOTIVE";
	constructor(options: MovableOptions) {
		super("LOCOMOTIVE", options);
	}
	metadata(): MovableOptions {
		return {
			couplerType: this.couplerType,
			model: this.model,
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

		return this._modify(data, actor);
	}

	static is(movable: Movable): movable is Locomotive {
		return movable instanceof this;
	}
}

class LocomotiveLink extends MovableLink {
	public override readonly type = "locomotivelink";
	public readonly locomotiveId: string;
	public get locomotive() {
		const l = this.session.client.movableManager.getLoco(this.locomotiveId);
		if (!l) throw new TMError(`EINTERNAL`);
		return l;
	}
	constructor(options: LocomotiveLinkOptions) {
		super(`locomotivelink`, options);

		this.locomotiveId = options.locomotiveId;
	}

	private _controllerId?: string;
	public get controllerId() {
		return this._controllerId;
	}
	public get controller() {
		if (!this.controllerId) return undefined;
		return this.session.userLinkManager.get(this.controllerId);
	}
	private set controller(ctl: UserLink | undefined) {
		this._controllerId = ctl?.id;
		const trueTimestamp = this.session.timeManager.trueMs;
		this.manager.db.redis.xadd(
			this.manager.key(`${this.id}:controllers`),
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
		return this.session.trainManager.trains.find(
			(t) => t.locomotiveLink === this
		);
	}

	modify(): boolean {
		return false;
	}

	metadata(): LocomotiveLinkOptions {
		return {
			id: this.id,
			locomotiveId: this.locomotiveId,
			managerId: this.managerId,
			movableId: this.movableId,
			sessionId: this.sessionId,
			controllerId: this._controllerId,
			currentLocation: this.currentLocation && {
				stationLinkId: this.currentLocation.stationLink.id,
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
}

export { Locomotive, LocomotiveLink, LocomotiveLinkOptions };
