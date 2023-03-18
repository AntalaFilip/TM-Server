import Collection from "@discordjs/collection";
import type { Server as SIOServer } from "socket.io";
import { Manager, Redis, TMLogger } from "../internal";

const managers = new Collection<string, BaseManager>();

abstract class BaseManager {
	readonly id: string;
	readonly db: Redis;
	readonly io: SIOServer;
	readonly client: Manager;
	readonly logger: TMLogger;

	constructor(id: string, io: SIOServer, client: Manager, db?: Redis) {
		this.id = id;
		this.db = db ?? new Redis(this.id);
		this.io = io;
		this.client = client;
		this.logger = new TMLogger(this.id.toUpperCase());

		managers.set(this.id, this);
	}

	static get(id: string) {
		return managers.get(id);
	}

	key(name: string): string {
		return `${this.id}:${name}`;
	}
}

export { BaseManager };
