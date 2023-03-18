import Collection from "@discordjs/collection";
import crypto from "crypto";
import {
	BaseManager,
	Manager,
	ResourceData,
	Session,
	SessionResourceManager,
	TMError,
	User,
	UserConstructorOptions,
	UserLink,
	UserLinkOptions,
	UserOptions,
} from "../internal";

class UserManager extends BaseManager implements ResourceData<UserManager> {
	public readonly users: Collection<string, User>;

	public readonly ready: Promise<void>;

	constructor(client: Manager) {
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
						email: "root@ahst.sk",
						sessionId: null,
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

	get(id: string, error: true): User;
	get(id: string, error?: boolean): User | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.users.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.users.map((u) => u.publicMetadata());
	}

	async create(
		resource: User | UserConstructorOptions,
		actor?: User
	): Promise<User> {
		actor && User.checkPermission(actor, "manage users");

		if (!(resource instanceof User)) {
			resource = new User(resource);
		}

		if (this.users.has(resource.id))
			throw new Error(`This User is already created!`);

		this.users.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	async fromResourceIdentifier(id: string): Promise<User | undefined> {
		const userData = await this.db.redis.hget("users", id);
		if (!userData) return;
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

class UserLinkManager extends SessionResourceManager {
	public readonly links: Collection<string, UserLink>;

	public readonly ready: Promise<void>;

	constructor(session: Session) {
		super(session, `userlinks`);
		this.links = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(`Ready; ${this.links.size} userlinks loaded`);
				res();
			});
		});
	}

	get(id: string, error: true): UserLink;
	get(id: string, error?: boolean): UserLink | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.links.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}

	getByUser(user: User, error: true): UserLink;
	getByUser(user: User): UserLink | undefined;
	getByUser(user: User, error?: boolean): unknown {
		const u = this.links.find((l) => l.user === user);
		if (!u && error)
			throw new TMError(`EINVALIDINPUT`, `This user is not linked!`);
		return u;
	}
	getOne(id: string) {
		return this.links.get(id)?.fullMetadata();
	}
	getAll() {
		return this.links.map((l) => l.publicMetadata());
	}

	async fromResourceIdentifier(id: string): Promise<UserLink | undefined> {
		const userData = await this.db.redis.hget(this.id, id);
		if (!userData) return;
		const userLinkMeta = JSON.parse(userData) as UserLinkOptions;

		return new UserLink(userLinkMeta);
	}

	private async createAllFromStore() {
		const allUserLinks = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allUserLinks);
		for (const r of arr) {
			try {
				const v = JSON.parse(r[1]) as UserLinkOptions;
				await this.create(v);
			} catch (err) {
				this.logger.warn(`Malformed userlink data @ ${r[0]}`);
			}
		}

		return true;
	}

	async create(
		resource: UserLink | UserLinkOptions,
		actor?: UserLink
	): Promise<UserLink> {
		actor && User.checkPermission(actor.user, "manage users", this.session);

		if (!(resource instanceof UserLink)) {
			resource = new UserLink(resource);
		}
		if (!(resource instanceof UserLink)) {
			throw new TMError(`EINTERNAL`);
		}

		if (this.links.has(resource.id))
			throw new Error(`This UserLink is already created!`);

		this.links.set(resource.id, resource);
		await resource.save();
		return resource;
	}
}

export { UserManager, UserLinkManager };
