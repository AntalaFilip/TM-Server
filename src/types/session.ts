import { Namespace as SIONamespace } from "socket.io";
import {
	ADSManager,
	Manager,
	MovableLinkManager,
	Redis,
	Resource,
	ResourceOptions,
	StationLinkManager,
	TimeManager,
	Timetable,
	TimetableManager,
	TMError,
	TMLogger,
	TrainManager,
	TrainSetManager,
	User,
	UserLink,
	UserLinkManager,
} from "../internal";

type SessionState = "SETUP" | "SYSTEM_SETUP" | "READY";

interface SessionOptions extends ResourceOptions<null> {
	name: string;
	ownerId: string;
	ionsp?: SIONamespace;
	db?: Redis;
	activeTimetableId?: string;
	sessionState: SessionState;
}

class Session extends Resource<null> {
	public readonly logger: TMLogger;

	private _ownerId: string;
	public get ownerId() {
		return this._ownerId;
	}
	private set ownerId(newOwner: string) {
		this.ownerId = newOwner;
		this.propertyChange(`ownerId`, newOwner);
	}
	public get owner() {
		return this.client.userManager.get(this.ownerId);
	}

	public readonly ready: Promise<void>;

	private _name: string;
	public get name(): string {
		return this._name;
	}
	private set name(name: string) {
		this._name = name;
		this.propertyChange(`name`, name);
	}

	private _state: SessionState;
	public get state() {
		return this._state;
	}
	private set state(state: SessionState) {
		this._state = this.state;
		this.propertyChange("sessionState", state);
	}

	public readonly ionsp: SIONamespace;
	public readonly db: Redis;
	public readonly client: Manager;

	public override get manager(): null {
		return null;
	}

	private _activeTimetableId?: string;
	public get activeTimetableId() {
		return this._activeTimetableId;
	}
	private set activeTimetableId(id: string | undefined) {
		this._activeTimetableId = id;
		this.propertyChange(`activeTimetableId`, id);
	}
	public get activeTimetable(): Timetable | undefined {
		return this.activeTimetableId
			? this.timetableManager.get(this.activeTimetableId)
			: undefined;
	}

	// Managers
	public readonly timeManager: TimeManager;
	public readonly trainSetManager: TrainSetManager;
	public readonly trainManager: TrainManager;
	public readonly timetableManager: TimetableManager;
	public readonly userLinkManager: UserLinkManager;
	public readonly stationLinkManager: StationLinkManager;
	public readonly movableLinkManager: MovableLinkManager;
	public readonly aDSManager: ADSManager;

	constructor(client: Manager, options: SessionOptions) {
		super("session", options);
		this.client = client;
		this._ownerId = options.ownerId;

		this._name = options.name || this.id;
		this.ionsp = options.ionsp ?? this.client.io.of(`/sessions/${this.id}`);
		this.db = options.db ?? new Redis(`sessions:${this.id}`);
		this.logger = new TMLogger(
			`SESSION:${this.id}`,
			`SESSION:${this.shortId}`
		);
		this._state = options.sessionState;

		this.timeManager = new TimeManager(this);
		this.movableLinkManager = new MovableLinkManager(this);
		this.trainSetManager = new TrainSetManager(this);
		this.stationLinkManager = new StationLinkManager(this);
		this.trainManager = new TrainManager(this);
		this.timetableManager = new TimetableManager(this);
		this.userLinkManager = new UserLinkManager(this);
		this.aDSManager = new ADSManager(this);

		// eslint-disable-next-line no-async-promise-executor
		this.ready = new Promise(async (res, rej) => {
			try {
				await this.timeManager.ready;
				await this.trainSetManager.ready;
				await this.trainManager.ready;
				await this.timetableManager.ready;
				await this.userLinkManager.ready;
				await this.stationLinkManager.ready;
				await this.movableLinkManager.ready;
				await this.aDSManager.ready;

				if (this.activeTimetable) {
					try {
						this.logger.verbose(`Running Timetable checks...`);
						const c = this.activeTimetable.runChecks();
						if (!c) throw new Error("invalid timetable");
					} catch (err) {
						this.logger.warn(
							`Invalid active timetable (${this.activeTimetable.id.slice(
								this.activeTimetable.id.length - 6
							)})! Resetting...`
						);
						this._activeTimetableId = undefined;
						await this.aDSManager.clearTimetableADS();
						// TODO: notify
					}
				}

				await this.save();

				this.logger.info(`Session (...${this.shortId}) ready!`);
				res();
			} catch (err) {
				rej(err);
			}
		});
	}

	async setActiveTimetable(timetable: Timetable): Promise<boolean> {
		if (!timetable.runChecks()) return false;
		this.logger.verbose(`Setting active timetable (${timetable.id})`);
		const prevState = this.state;
		this.setSessionState("SYSTEM_SETUP");
		this.activeTimetableId = timetable.id;
		await this.aDSManager.regenerateADS();

		this.setSessionState(prevState);
		return true;
	}

	setSessionState(state: SessionState, actor?: UserLink) {
		actor && User.checkPermission(actor.user, "manage sessions", this);

		if (
			(this.state === "SYSTEM_SETUP" ||
				state === "SYSTEM_SETUP") &&
			actor
		) {
			throw new TMError(
				`EFORBIDDEN`,
				`You may not change system-defined state, it will be done automatically. `
			);
		}

		if (state === "SYSTEM_SETUP" || state === "SETUP") {
			this.timeManager.setRunning(false);
		}

		this._state = state;
	}

	metadata(): SessionOptions {
		return {
			managerId: this.managerId,
			name: this.name,
			sessionId: this.sessionId,
			id: this.id,
			ownerId: this.ownerId,
			activeTimetableId: this.activeTimetableId,
			sessionState: this.state,
		};
	}

	async modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage sessions", this))
			throw new Error(`No permission`);
		let modified = false;

		// TODO: auditing

		if (typeof data.name === "string") {
			this.name = data.name;
			modified = true;
		}
		if (typeof data.owner === "string" && this.owner === actor) {
			const newOwner = this.client.userManager.get(data.owner);
			if (newOwner) {
				this.ownerId = newOwner.id;
				modified = true;
			}
		}
		if (typeof data.activeTimetableId === "string") {
			const timetable = this.timetableManager.get(data.activeTimetableId);
			if (timetable && timetable.runChecks()) {
				this.activeTimetableId = timetable.id;
				modified = true;
			}
		}

		if (!modified) return false;
		return true;
	}

	publicMetadata() {
		return {
			...this.metadata(),
		};
	}

	fullMetadata() {
		return {
			...this.metadata(),
			owner: this.owner?.publicMetadata(),
			activeTimetable: this.activeTimetable?.publicMetadata(),
		};
	}

	async save(): Promise<boolean> {
		await this.db.redis.hset("sessions", [
			this.id,
			JSON.stringify(this.metadata()),
		]);
		return true;
	}
}

export { Session, SessionOptions, SessionState };
