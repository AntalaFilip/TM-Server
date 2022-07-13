import RedisClient from "ioredis";
import { config } from "dotenv";
config();

const redis = new RedisClient(process.env.REDIS_URL, {
	password: process.env.REDIS_PASS,
	keyPrefix: process.env.REDIS_PREFIX,
});

/**
 * Redis ID Structure as follows:
 * `PREFIX:trainmanager:`
 * - `realms:REALM:`
 * 	- `stations:STATION:`
 * 		- `tracks`
 * 	- `time`
 */
class Redis {
	readonly name: string;
	readonly redis: RedisClient;

	constructor(name: string) {
		this.name = name;
		this.redis = redis;
	}

	async add(
		key: string,
		data: object | number | string | Buffer
	): Promise<boolean> {
		if (typeof data === "object") data = JSON.stringify(data);

		return (await this.redis.set(`${this.name}:${key}`, data)) === "OK";
	}

	async get(key: string): Promise<unknown> {
		const data = await this.redis.get(key);
		try {
			return JSON.parse(data);
		} catch {
			if (!Number.isNaN(data)) return Number(data);

			return data;
		}
	}

	async del(key: string | string[]): Promise<number> {
		return await this.redis.del(...key);
	}
}

export default Redis;
