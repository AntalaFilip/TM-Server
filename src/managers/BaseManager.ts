import { Server as SIOServer } from "socket.io";
import Redis from "../helpers/redis";

abstract class BaseManager {
	readonly id: string;
	readonly db: Redis;
	readonly io: SIOServer;

	constructor(id: string, io: SIOServer, db?: Redis) {
		this.id = id;
		this.db = db ?? new Redis(this.id);
		this.io = io;
	}
}

export default BaseManager;