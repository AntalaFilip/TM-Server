import Collection from "@discordjs/collection";
import { Server as SIOServer } from "socket.io";
import TMLogger from "../helpers/logger";
import Redis from "../helpers/redis";
import Client from "../types/client";

const managers = new Collection<string, BaseManager>();

abstract class BaseManager {
	readonly id: string;
	readonly db: Redis;
	readonly io: SIOServer;
	readonly client: Client;
	readonly logger: TMLogger;

	constructor(id: string, io: SIOServer, client: Client, db?: Redis) {
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
}

export default BaseManager;
