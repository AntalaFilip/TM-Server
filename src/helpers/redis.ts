import RedisClient from "ioredis";
const redis = new RedisClient(process.env.REDIS_URL, { password: process.env.REDIS_PASS });

class Redis {
	readonly name: string;
	readonly redis: RedisClient;

	constructor(name: string) {
		this.name = name;
		this.redis = redis;
	}

	async add(key: string, data: any): Promise<boolean> {
		if (typeof data === 'object') data = JSON.stringify(data);

		return (await this.redis.set(`${this.name}:${key}`, data)) === 'OK';
	}

	async get(key: string): Promise<any> {
		const data = await this.redis.get(key);
		try {
			return JSON.parse(data);
		}
		catch {
			if (Number(data) != NaN) return Number(data);
			
			return data;
		}
	}

	async del(key: string | string[]): Promise<number> {
		return await this.redis.del(...key);
	}
}

export default Redis;