import { Server as SIOServer } from "socket.io";
import http from 'http';
import Collection from "@discordjs/collection";
import Realm, { RealmOptions } from "./realm";
import { ResourceData } from "../managers/ResourceManager";
import Redis from "../helpers/redis";
import UserManager from "../managers/UserManager";
import { Application } from 'express';
import createIndexRouter from "../routes";

interface ClientOptions {
	io: SIOServer,
	express: Application,
	http: http.Server;
}

class Client implements ResourceData {
	public readonly io: SIOServer;
	public readonly express: Application;
	public readonly http: http.Server;
	public readonly db: Redis;

	public readonly realms: Collection<string, Realm>;

	public readonly userManager: UserManager;
	public readonly ready: Promise<void>;

	constructor(options: ClientOptions) {
		this.io = options.io;
		this.express = options.express;
		this.http = options.http;
		this.db = new Redis('');

		this.realms = new Collection();
		this.userManager = new UserManager(this);

		this.ready = new Promise((res) => {
			this.userManager.ready
				.then(() => {
					this.createAllFromStore()
						.then(() => {
							const httpRouter = createIndexRouter(this);
							this.express.use(httpRouter);

							console.log(`Client ready; ${this.realms.size} Realms active`);
							res();
						});
				});

		});
	}

	private async createAllFromStore() {
		const allRealms = await this.db.redis.hgetall('realms');
		const arr = Object.entries(allRealms);
		for (const r of arr) {
			const v = JSON.parse(r[1]) as RealmOptions;
			await this.create(v);
		}

		return true;
	}

	async create(resource: Realm | RealmOptions): Promise<Realm> {
		if (this.realms.has(resource.id)) throw new Error(`This Realm already exists!`);

		if (!(resource instanceof Realm)) {
			resource = new Realm(this, resource);
		}

		await resource.ready;

		this.realms.set(resource.id, resource);
		return resource;
	}

	/** Creates a Realm from a resource identifier (redis key) */
	async fromResourceIdentifier(id: string): Promise<Realm> {
		const realmData = await this.db.redis.hget('realms', id);
		if (!realmData) return;

		const realmMeta = JSON.parse(realmData) as RealmOptions;

		return new Realm(this, realmMeta);
	}

}

export default Client;
export { ClientOptions };