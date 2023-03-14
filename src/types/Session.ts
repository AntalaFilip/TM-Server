import { ForbiddenError } from "apollo-server-core";
import TMLogger from "../helpers/logger";
import ADSManager from "../managers/ADSManager";
import ResourceManager from "../managers/ResourceManager";
import TimeManager from "../managers/TimeManager";
import Resource, { ResourceOptions } from "./Resource";
import TMError from "./TMError";
import User from "./User";

interface SessionOptions extends ResourceOptions {
	name: string;
	started: Date;
	ended: Date | null;
	sessionCoordinatorId: string;
	activeTimetableId?: string;
}

class Session extends Resource<ResourceManager, false> {
	public readonly ready: Promise<void>;
	public readonly sessionCoordinatorId: string;
	public get sessionCoordinator() {
		const user = this.realm.client.userManager.get(
			this.sessionCoordinatorId
		);
		if (!user)
			throw new TMError(
				`EINTERNALINVALIDVALUE`,
				`Invalid value of sessionCoordinatorId!`,
				{ this: this, private: true }
			);
		return user;
	}

	public sessionData: undefined;

	private _name: string;
	public get name() {
		return this._name;
	}
	private set name(name: string) {
		this._name = name;
		this.propertyChange(`name`, name);
	}

	public readonly started: Date;
	private _ended: Date | null;
	public get ended() {
		return this._ended;
	}
	private set ended(ended: Date | null) {
		this._ended = ended;
	}

	public get isActive(): boolean {
		return this.realm.currentSession === this;
	}

	private _activeTimetableId?: string;
	public get activeTimetable() {
		if (!this._activeTimetableId) return;
		return this.realm.timetableManager.get(this._activeTimetableId);
	}

	public readonly logger: TMLogger;
	public readonly timeManager: TimeManager;
	public readonly aDSManager: ADSManager;

	constructor(options: SessionOptions) {
		super("session", options);
		this.logger = new TMLogger(
			`${this.type.toUpperCase()}:${this.realmId}:${this.id}`,
			`${this.type.toUpperCase()}:${this.realm.shortId}:${this.shortId}`
		);

		this._name = options.name;
		this.started = options.started;
		this._ended = options.ended;
		this.sessionCoordinatorId = options.sessionCoordinatorId;

		this.timeManager = new TimeManager(this);
		this.aDSManager = new ADSManager(this);

		// eslint-disable-next-line no-async-promise-executor
		this.ready = new Promise(async (res, rej) => {
			try {
				await this.timeManager.ready;
				await this.aDSManager.ready;

				await this.save();
				this.logger.info(`Ready!`);
				res();
			} catch (err) {
				if (err instanceof TMError) {
					if (err.code === 'ETIMEMALFORMED') {
						// TODO: implement rejection
					}
				}
				rej(err);
			}
		});
		// TODO: make sure that failed Session loads (on corrupted data from TimeManager constructions, for example)
		// are dealth with accordingly, and that the user can actually tell that an error occurred.
	}

	publicMetadata(): SessionOptions {
		return {
			managerId: this.managerId,
			id: this.id,
			ended: this.ended,
			started: this.started,
			name: this.name,
			realmId: this.realmId,
			sessionCoordinatorId: this.sessionCoordinatorId,
			activeTimetableId: this.activeTimetable?.id,
		};
	}

	metadata(): SessionOptions {
		return this.publicMetadata();
	}

	fullMetadata(): SessionOptions {
		return this.metadata();
	}

	modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission(`manage sessions`, this.realm))
			throw new ForbiddenError(`No permission`, {
				permission: `manage stations`,
			});
		let modified = false;

		if (typeof data.name === "string") {
			this.name = data.name;
			modified = true;
		}

		return modified;
	}

	endSession(actor: User) {
		if (!actor.hasPermission(`manage sessions`, this.realm))
			throw new ForbiddenError(`No permission`, {
				permission: `manage stations`,
			});

		if (this.ended)
			throw new TMError(
				`ESESSIONENDED`,
				`The session has already ended!`,
				{
					realmId: this.realmId,
					sessionId: this.id,
				}
			);

		this.ended = new Date();
	}

	async save() {
		await this.manager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}

export default Session;
export { SessionOptions };
