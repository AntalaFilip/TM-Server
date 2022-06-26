import { Namespace as SIONamespace } from "socket.io";
import Redis from "../helpers/redis";
import MovableManager from "../managers/MovableManager";
import StationManager from "../managers/StationManager";
import TimeManager from "../managers/TimeManager";
import TimetableManager from "../managers/TimetableManager";
import TrainManager from "../managers/TrainManager";
import TrainSetManager from "../managers/TrainSetManager";
import Client from "./client";
import Resource, { ResourceOptions } from "./resource";
import Timetable from "./timetable";
import User from "./user";

interface RealmOptions extends ResourceOptions {
	name: string,
	ownerId: string,
	ionsp?: SIONamespace,
	db?: Redis,
	activeTimetableId?: string,
}

class Realm extends Resource {
	public readonly id: string;
	public readonly owner: User;
	public readonly ready: Promise<void>;

	private _name: string;
	public get name(): string { return this._name; }
	private set name(name: string) { this._name = name; }

	public readonly ionsp: SIONamespace;
	public readonly db: Redis;
	public readonly client: Client;

	public override get manager(): null { return null; }

	private _activeTimetableId: string;
	public get activeTimetableId() { return this._activeTimetableId; }
	private set activeTimetableId(id: string) {
		this._activeTimetableId = id;
		this.propertyChange(`activeTimetableId`, id);
	}
	public get activeTimetable() { return this.timetableManager?.get(this.activeTimetableId); }

	// Managers
	public readonly stationManager: StationManager;
	public readonly timeManager: TimeManager;
	public readonly trainSetManager: TrainSetManager;
	public readonly trainManager: TrainManager;
	public readonly movableManager: MovableManager;
	public readonly timetableManager: TimetableManager;

	constructor(client: Client, options: RealmOptions) {
		super('realm', options);
		this.client = client;
		this.owner = this.client.userManager.get(options.ownerId);

		this.name = options.name || this.id;
		this.ionsp = options.ionsp ?? this.client.io.of(`/realms/${this.id}`);
		this.db = options.db ?? new Redis(`realms:${this.id}`);

		this.stationManager = new StationManager(this);
		this.timeManager = new TimeManager(this);
		this.trainSetManager = new TrainSetManager(this);
		this.trainManager = new TrainManager(this);
		this.movableManager = new MovableManager(this);
		this.timetableManager = new TimetableManager(this);

		// eslint-disable-next-line no-async-promise-executor
		this.ready = new Promise(async (res, rej) => {
			try {
				await this.timeManager.ready;
				await this.stationManager.ready;
				await this.trainSetManager.ready;
				await this.trainManager.ready;
				await this.movableManager.ready;
				await this.timetableManager.ready;

				if (this.activeTimetable) {
					try {
						const c = this.activeTimetable.runChecks();
						if (!c) throw new Error('invalid timetable');
					}
					catch (err) {
						this._activeTimetableId = null;
						// TODO: notify
					}
				}

				await this.save();

				console.log(`Realm (${this.id}) ready!`);
				res();
			}
			catch (err) {
				rej(err);
			}
		});
	}

	setActiveTimetable(timetable: Timetable) {
		if (!timetable.runChecks()) return false;

		this.activeTimetableId = timetable.id;
		return true;
	}

	metadata(): RealmOptions {
		return {
			managerId: this.managerId,
			name: this.name,
			realmId: this.realmId,
			id: this.id,
			ownerId: this.owner.id,
			activeTimetableId: this.activeTimetableId,
		};
	}

	async save(): Promise<boolean> {
		await this.db.redis.hset('realms', [this.id, JSON.stringify(this.metadata())]);
		return true;
	}
}

export default Realm;
export { RealmOptions };