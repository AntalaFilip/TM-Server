import Client from "../types/client";
import BaseManager from "../managers/BaseManager";
import { ResourceData } from "./ResourceManager";
import User, { UserOptions } from "../types/user";
import Collection from "@discordjs/collection";
import crypto from "crypto";
import { ForbiddenError } from "apollo-server-core";

class UserManager extends BaseManager implements ResourceData {
	public readonly users: Collection<string, User>;

	public readonly ready: Promise<void>;

	constructor(client: Client) {
		super(`users`, client.io, client);
		this.users = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(async () => {
				if (this.users.size === 0) {
					this.logger.warn(
						`UserManager attempted to load with no users available!`
					);
					this.logger.warn(`Automatically creating new user...`);
					const pwd = crypto.randomBytes(8).toString("hex");

					const user = await this.create({
						name: "Administrator",
						username: "administrator",
						realmId: null,
						managerId: this.id,
						passwordHash: User.hashPassword(pwd),
						admin: true,
					});
					this.logger.warn(
						`Created new administrative user '${user.username}' with password '${pwd}'`
					);
				}

				this.logger.debug(
					`Ready; ${this.users.size} users loaded, ${
						this.users.filter((u) => !u.disabled).size
					} users active`
				);
				res();
			});
		});
	}

	get(id: string) {
		return this.users.get(id);
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.users.map((u) => u.publicMetadata());
	}

	async create(resource: User | UserOptions, actor?: User): Promise<User> {
		if (actor && !actor.hasPermission(`manage users`))
			throw new ForbiddenError(`No permission!`, {
				tmCode: `ENOPERM`,
				permission: `manage users`,
			});

		if (!(resource instanceof User)) {
			resource = new User(resource);
		}

		if (this.users.has(resource.id))
			throw new Error(`This User is already created!`);

		this.users.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	async fromResourceIdentifier(id: string): Promise<User> {
		const userData = await this.db.redis.hget("users", id);
		const userMeta = JSON.parse(userData) as UserOptions;

		return new User(userMeta);
	}

	private async createAllFromStore() {
		const allUsers = await this.db.redis.hgetall(`users`);
		const arr = Object.entries(allUsers);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as UserOptions;
				await this.create(v);
			} catch (err) {
				this.logger.warn(`Malformed user data @ ${r[0]}`);
			}
		}

		return true;
	}
}

export default UserManager;
