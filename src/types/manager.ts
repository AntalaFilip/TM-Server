import Collection from "@discordjs/collection";
import { Application } from "express";
import http from "http";
import { Server as SIOServer } from "socket.io";
import {
	createIndexRouter,
	MovableManager,
	Redis,
	ResourceData,
	Session,
	SessionOptions,
	StationManager,
	TMError,
	TMLogger,
	User,
	UserManager,
} from "../internal";

interface ManagerOptions {
	io: SIOServer;
	express: Application;
	http: http.Server;
}

class Manager implements ResourceData<null> {
	public readonly io: SIOServer;
	public readonly express: Application;
	public readonly http: http.Server;
	public readonly db: Redis;
	public readonly logger: TMLogger;

	public readonly sessions: Collection<string, Session>;

	public readonly userManager: UserManager;
	public readonly stationManager: StationManager;
	public readonly movableManager: MovableManager;
	public readonly ready: Promise<void>;

	constructor(options: ManagerOptions) {
		this.io = options.io;
		this.express = options.express;
		this.http = options.http;
		this.db = new Redis("");
		this.logger = new TMLogger(`TRAINMANAGER`);

		this.sessions = new Collection();
		this.userManager = new UserManager(this);
		this.stationManager = new StationManager(this);
		this.movableManager = new MovableManager(this);

		// eslint-disable-next-line no-async-promise-executor
		this.ready = new Promise(async (res, rej) => {
			try {
				await this.userManager.ready;
				await this.createAllFromStore();
				const httpRouter = createIndexRouter(this);
				this.express.use("/api", httpRouter);

				this.logger.info(
					`Ready; ${this.sessions.size} Sessions active`
				);
				res();
			} catch (err) {
				rej(err);
			}
		});
	}

	get(id: string, error: true): Session;
	get(id: string): Session | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.sessions.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.sessions.map((r) => r.publicMetadata());
	}

	private async createAllFromStore() {
		const allSessions = await this.db.redis.hgetall("sessions");
		const arr = Object.entries(allSessions);
		for (const r of arr) {
			const v = JSON.parse(r[1]) as SessionOptions;
			await this.create(v);
		}

		return true;
	}

	async create(
		resource: Session | SessionOptions,
		actor?: User
	): Promise<Session> {
		actor && User.checkPermission(actor, "manage sessions");

		if (this.sessions.has(resource.id))
			throw new Error(`This Session already exists!`);

		if (!(resource instanceof Session)) {
			resource = new Session(this, resource);
		}
		if (!(resource instanceof Session)) throw new TMError("EINTERNAL");

		await resource.ready;

		this.sessions.set(resource.id, resource);
		return resource;
	}

	/** Creates a Session from a resource identifier (redis key/resource id) */
	async fromResourceIdentifier(id: string): Promise<Session> {
		const sessionData = await this.db.redis.hget("sessions", id);
		if (!sessionData) throw new TMError(`EINTERNAL`);

		const sessionMeta = JSON.parse(sessionData) as SessionOptions;

		return new Session(this, sessionMeta);
	}
}

export { Manager, ManagerOptions };
