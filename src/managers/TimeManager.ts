import Realm from "../types/realm";
import User from "../types/user";
import BaseManager from "./BaseManager";

interface TimeOptions {
	startPoint: number,
	speedModifier: number,
	trueElapsed?: number,
	elapsed?: number,
	running?: boolean,
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
	public readonly realm: Realm;
	public readonly ready: Promise<void>;

	private _running = false;
	/** Whether the time is currently running */
	public get running() { return this._running }
	private set running(state: boolean) {
		this.save(false, true);
		this._running = state;
		this.save();
	}

	private _startPoint: number;
	/** The starting point of true realm time in milliseconds */
	public get startPoint() { return this._startPoint }
	private set startPoint(point: number) {
		this.save(false, true);
		this._startPoint = point;
		this.save();
	}

	private _speedModifier: number;
	/** The speed modifier of the true realm time opposed to real time */
	public get speedModifier() { return this._speedModifier }
	private set speedModifier(speed: number) {
		this.save(false, true);
		if (speed > 1000) speed = 1000;
		this._speedModifier = speed;
		this.save();
	}

	private _elapsed: number;
	/** Time of the last save */
	public get elapsed() { return this._elapsed }

	private _trueElapsed: number;
	/** True elapsed time (TrueMS) at last data save */
	public get trueElapsed() { return this._trueElapsed }

	/** How many real-time milliseconds passed since last save */
	public get realDiff() { return Math.abs(Date.now() - this.elapsed) }

	/** How many true realm-time milliseconds passed since last save */
	public get trueDiff() { return this.realDiff * this.speedModifier }

	/** How many true realm-time milliseconds passed from the start */
	public get trueMs() {
		if (!this.running) return this.trueElapsed;
		return this.trueElapsed + this.trueDiff;
	}

	/** Current true realm-time Date, according to the starting point */
	public get trueDate() { return new Date(this.trueMs + this.startPoint) }

	/** Current formatted realm time as HH:mm:ss */
	public get formattedTrueTime() { return this.trueDate.toLocaleTimeString('sk-SK', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }

	constructor(realm: Realm, options?: TimeOptions) {
		super(`realms:${realm.id}:time`, realm.ionsp.server, realm.client);
		this.realm = realm;

		// eslint-disable-next-line no-async-promise-executor
		this.ready = new Promise(async (res, rej) => {
			try {
				if (!options) {
					const meta = await this.db.redis.get(`${this.id}:metadata`) ?? '{}';
					try {
						options = JSON.parse(meta);
					}
					catch {
						// TODO: do not load with malformed data / disable realm
						console.warn(`Malformed Time data @ Realm ${realm.id}`);
					}
				}

				this._startPoint = options?.startPoint ?? 0;
				// max allowed speed is 1000x
				this._speedModifier = (options?.speedModifier > 1000 ? 1000 : options?.speedModifier) ?? 1;
				this._elapsed = options?.elapsed ?? Date.now();
				this._trueElapsed = options?.trueElapsed ?? 0;

				await this.save();
				console.log(`TimeManager (${this.id}) ready; current time: ${this.trueDate.toUTCString()}`)
				res();
			}
			catch (err) {
				rej(err);
			}
		});
	}

	get(): null { return null }

	fromResourceIdentifier(): null { return null }

	/** Returns all the necessary data to reconstruct the Time Manager and calculate the time */
	metadata(): TimeOptions {
		return {
			startPoint: this.startPoint,
			speedModifier: this.speedModifier,
			trueElapsed: this.trueMs,
			elapsed: this.elapsed,
			running: this.running,
		}
	}

	setRunning(state: boolean, actor: User) {
		if (!actor.hasPermission('control time', this.realm)) throw new Error(`No permission`);

		// TODO: auditing
		this.running = state;
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
		if (bc) this.realm.ionsp.emit('time metadata', meta);
		if (!memoryOnly) await this.db.add('metadata', meta);

		return true;
	}
}

export default TimeManager;
export { TimeOptions };