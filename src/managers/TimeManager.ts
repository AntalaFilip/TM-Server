import { BaseManager, Session, TMLogger, User, UserLink } from "../internal";

interface TimeOptions {
	startPoint: number;
	speedModifier: number;
	trueElapsed?: number;
	elapsed?: number;
	running?: boolean;
	restricted: boolean;
}

/**
	Something a bit complex, with badly named variables :)
	Essentially, just lots of calculations based on current time
	and the time of the last data save.
	TRUE time refers to simulated time in the Realm, while
	REAL time refers to real time, duh.

	A save is triggered either manually, or when any (changeable) property changes:
		At save, the current REAL time is saved into TimeManager.elapsed
		and the current TRUE time into TimeManager.trueElapsed (in exactly the opposite order)
	From that the REAL time passed (realDiff) since save can be easily calculated,
	and from that, the TRUE time passed (trueDiff). Finally, from the TRUE difference,
	we can easily get the actual amount of TRUE time that's passed.
*/
class TimeManager extends BaseManager {
	public readonly session: Session;
	public readonly ready: Promise<void>;
	public override readonly logger: TMLogger;

	private _restricted = true;
	public get restricted() {
		return this._restricted;
	}
	private set restricted(state: boolean) {
		this.save(false, true);
		this._restricted = state;
		this.save();
	}

	public get canRun() {
		return this.session.state === "READY";
	}

	private _running = false;
	/** Whether the time is currently running */
	public get running() {
		return this._running;
	}
	private set running(state: boolean) {
		this.save(false, true);
		this._running = state;
		this.save();
	}

	private _startPoint = new Date(0);
	/** The starting point of true realm time in milliseconds */
	public get startPoint() {
		return this._startPoint;
	}
	private set startPoint(point: Date) {
		this.save(false, true);
		this._startPoint = point;
		this.save();
	}

	private _speedModifier = NaN;
	/** The speed modifier of the true realm time opposed to real time */
	public get speedModifier() {
		return this._speedModifier;
	}
	private set speedModifier(speed: number) {
		this.save(false, true);
		if (speed > 1000) speed = 1000;
		this._speedModifier = speed;
		this.save();
	}

	private _elapsed = NaN;
	/** Time of the last save */
	public get elapsed() {
		return this._elapsed;
	}

	private _trueElapsed = NaN;
	/** True elapsed time (TrueMS) at last data save */
	public get trueElapsed() {
		return this._trueElapsed;
	}

	/** How many real-time milliseconds passed since last save */
	public get realDiff() {
		return Math.abs(Date.now() - this.elapsed);
	}

	/** How many true realm-time milliseconds passed since last save */
	public get trueDiff() {
		return this.realDiff * this.speedModifier;
	}

	/** How many true realm-time milliseconds passed from the start */
	public get trueMs() {
		if (!this.running) return this.trueElapsed;
		return this.trueElapsed + this.trueDiff;
	}

	/** Current true realm-time Date, according to the starting point */
	public get trueDate() {
		return new Date(this.trueMs + this.startPoint.getTime());
	}

	/** Current formatted realm time as HH:mm:ss */
	public get formattedTrueTime() {
		return this.trueDate.toLocaleTimeString("sk-SK", {
			timeZone: "UTC",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	constructor(session: Session, options?: TimeOptions) {
		super(
			`realms:${session.id}:time`,
			session.ionsp.server,
			session.client
		);
		this.session = session;
		this.logger = new TMLogger(
			`TIME:${session.id}`,
			`TIME:${session.shortId}`
		);

		// eslint-disable-next-line no-async-promise-executor
		this.ready = new Promise(async (res, rej) => {
			try {
				if (!options) {
					const meta =
						(await this.db.redis.get(`${this.id}:metadata`)) ??
						"{}";
					try {
						options = JSON.parse(meta);
					} catch {
						// TODO: do not load with malformed data / disable realm
						this.logger.warn(
							`Malformed Time data @ Realm ${session.id}`
						);
					}
				}

				this._restricted = options?.restricted ?? false;
				this._startPoint = new Date(options?.startPoint ?? 0);
				// max allowed speed is 100x
				this._speedModifier =
					((options?.speedModifier ?? 1) > 100
						? 100
						: options?.speedModifier) ?? 1;
				this._elapsed = options?.elapsed ?? Date.now();
				this._trueElapsed = options?.trueElapsed ?? 0;

				await this.save();
				this.logger.debug(
					`Ready; current time: ${this.trueDate.toUTCString()}`
				);
				res();
			} catch (err) {
				rej(err);
			}
		});
	}

	get(): null {
		return null;
	}
	getOne(): null {
		return null;
	}
	getAll() {
		return this.metadata();
	}

	fromResourceIdentifier(): null {
		return null;
	}

	/** Returns all the necessary data to reconstruct the Time Manager and calculate the time */
	metadata(): TimeOptions {
		return {
			startPoint: this.startPoint.getTime(),
			speedModifier: this.speedModifier,
			trueElapsed: this.trueMs,
			elapsed: this.elapsed,
			running: this.running,
			restricted: this.restricted,
		};
	}

	setRunning(state: boolean, actor?: UserLink) {
		actor && User.checkPermission(actor.user, "control time", this.session);

		this.restricted &&
			actor &&
			User.checkPermission(actor.user, "manage time", this.session);

		// TODO: auditing
		this.running = state;
	}

	modify(data: Record<string, unknown>, actor: User) {
		User.checkPermission(actor, "manage time");
		let modified = false;

		// TODO: auditing

		// TODO: startpoint changes are potentially destructive
		if (data.startPoint instanceof Date) {
			this.startPoint = data.startPoint;
			modified = true;
		}
		if (typeof data.speedModifier === "number") {
			this.speedModifier = data.speedModifier;
			modified = true;
		}
		if (typeof data.running === "boolean") {
			this.running = data.running;
			modified = true;
		}
		if (typeof data.restricted === "boolean") {
			this.restricted = data.restricted;
			modified = true;
		}

		if (!modified) return false;

		return true;
	}
	/**
	 * Saves current data to memory & Redis and broadcasts a Socket.IO event
	 * @param bc Whether to broadcast an SIO event (def: true)
	 * @param memoryOnly Whether to skip saving to Redis (def: false)
	 */
	async save(bc = true, memoryOnly = false): Promise<boolean> {
		// caution: order of these two actions is important!
		// changing elapsed first would change the value of trueElapsed,
		// thus we need to first save trueElapsed to not corrupt it.
		this._trueElapsed = this.trueMs;
		this._elapsed = Date.now();

		const meta = this.metadata();
		if (bc) this.session.ionsp.emit("time metadata", meta);
		if (!memoryOnly) await this.db.add("metadata", meta);

		return true;
	}
}

export { TimeManager, TimeOptions };
