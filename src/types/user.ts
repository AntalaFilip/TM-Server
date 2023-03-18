import bcrypt from "bcrypt";
import crypto from "crypto";
import {
	BaseManager,
	Errors,
	LocomotiveLink,
	Resource,
	ResourceOptions,
	Session,
	TMError,
	UserManager,
} from "../internal";

interface UserOptions extends UserPublicData {
	passwordHash?: string;
	settings?: UserSettings;
	email: string;
}

interface UserLinkOptions extends ResourceOptions {
	userId: string;
}

type UserConstructorOptions = Omit<UserOptions, "id" | "emailMD5"> & {
	id?: string;
};

interface UserPublicData extends Omit<ResourceOptions<UserManager>, "realmId"> {
	id: string;
	name: string;
	emailMD5: string;
	username: string;
	disabled?: boolean;
	admin?: boolean;
	permissions?: UserPermissionsMetadata;
}

interface UserPermissions {
	global: number;
	readonly session: Map<string, number>;
}

interface UserPermissionsMetadata {
	global: number;
	session: [string, number][];
}

type Permission = keyof typeof PermissionMap;

const PermissionMap = {
	"manage sessions": 1 << 0,
	"manage users": 1 << 1,
	"manage stations": 1 << 2,
	"manage movables": 1 << 3,
	"manage time": (1 << 4) + (1 << 5),
	"control time": 1 << 5,
	"assign users": (1 << 6) + (1 << 9),
	"manage trains": 1 << 7,
	"manage timetables": 1 << 8,
	"assign self": 1 << 9,
};

interface UserSettings {
	theme?: string;
}

class User extends Resource<UserManager> {
	private _name: string;
	public get name() {
		return this._name;
	}
	private set name(newName: string) {
		this._name = newName;
		this.propertyChange("name", this.name);
	}

	private _username: string;
	public get username() {
		return this._username;
	}
	private set username(username: string) {
		this._username = username;
		this.propertyChange("username", this.username);
	}

	private _email: string;
	public get email() {
		return this._email;
	}
	private set email(email: string) {
		this._email = email;
		this.propertyChange("emailMD5", this.emailMD5);
	}

	public get emailMD5() {
		return crypto.createHash("md5").update(this.email).digest("hex");
	}

	private _passwordHash?: string;
	private get passwordHash() {
		return this._passwordHash;
	}
	private set passwordHash(hash: string | undefined) {
		this._passwordHash = hash;
		this.save();
	}
	public get hasPassword() {
		return Boolean(this.passwordHash);
	}

	private _disabled: boolean;
	public get disabled() {
		return this._disabled;
	}
	private set disabled(state: boolean) {
		this._disabled = state;
		this.save();
	}

	private _admin: boolean;
	public get admin() {
		return this._admin;
	}
	private set admin(state: boolean) {
		this._admin = state;
		this.save();
	}

	public get owning(): Session[] {
		return Array.from(
			this.manager.client.sessions
				.filter((s) => s.owner === this)
				.values()
		);
	}

	private readonly permissions: UserPermissions;

	public readonly settings: UserSettings;
	public get userManager() {
		return BaseManager.get(`users`) as UserManager;
	}

	constructor(options: UserConstructorOptions) {
		options.managerId = "users";
		super("user", options);

		this._name = options.name;
		this._username = options.username;
		this._email = options.email;
		this._passwordHash = options.passwordHash;
		this._admin = options.admin ?? false;
		this.permissions = {
			global: options.permissions?.global ?? 0b0,
			session: new Map(options.permissions?.session),
		};
		this.settings = options.settings ?? {};
		this._disabled = options.disabled ?? false;
	}

	metadata(): UserOptions {
		return {
			id: this.id,
			name: this.name,
			username: this.username,
			email: this.email,
			emailMD5: this.emailMD5,
			managerId: this.managerId,
			passwordHash: this.passwordHash,
			settings: this.settings,
			disabled: this.disabled,
			admin: this.admin,
			permissions: this.permissionMeta(),
			sessionId: null,
		};
	}

	async modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage users") && actor != this)
			throw new Error(`No permission`);
		let modified = false;

		// TODO: auditing

		if (typeof data.name === "string") {
			this.name = data.name;
			modified = true;
		}
		if (typeof data.username === "string") {
			this.username = data.username;
			modified = true;
		}
		// TODO: email checking?
		if (typeof data.email === "string") {
			this.email = data.email;
			modified = true;
		}
		if (typeof data.password === "string") {
			this.passwordHash = User.hashPassword(data.password);
			modified = true;
		}
		if (typeof data.disabled === "boolean" && actor != this) {
			this.disabled = data.disabled;
			modified = true;
		}
		if (typeof data.admin === "boolean" && actor.admin) {
			this.admin = data.admin;
			modified = true;
		}
		if (typeof data.globalPermissions === "number" && actor.admin) {
			this.adjustGlobalPermissions(data.globalPermissions);
			modified = true;
		}
		if (
			typeof data.realmPermissions === "number" &&
			data.realmId === "string"
		) {
			const realm = actor.manager.client.sessions.get(data.realmId);
			if (realm) {
				this.adjustRealmPermissions(realm, data.realmPermissions);
				modified = true;
			}
		}

		if (!modified) return false;
		return true;
	}

	publicMetadata(): UserPublicData {
		return {
			name: this.name,
			username: this.username,
			emailMD5: this.emailMD5,
			admin: this.admin,
			disabled: this.disabled,
			id: this.id,
			permissions: this.permissionMeta(),
			managerId: this.managerId,
			sessionId: this.sessionId,
		};
	}
	fullMetadata() {
		return {
			...this.publicMetadata(),
		};
	}

	permissionMeta(): UserPermissionsMetadata {
		return {
			global: this.permissions?.global,
			session: Array.from(this.permissions?.session.entries()),
		};
	}

	hasPermission(perm: Permission, session?: Session): boolean {
		if (session) {
			const p = this.permissions.session.get(session.id) ?? 0;
			const explicit = (p & PermissionMap[perm]) === PermissionMap[perm];
			const implicit = session.owner === this || this.admin;
			return explicit || implicit;
		} else {
			const p = this.permissions.global;
			const explicit = (p & PermissionMap[perm]) === PermissionMap[perm];
			const implicit = this.admin;
			return explicit || implicit;
		}
	}

	public adjustGlobalPermissions(newPerm: number) {
		this.permissions.global = newPerm;
		this.save();
	}

	public adjustRealmPermissions(realm: Session, newPerm: number) {
		this.permissions.session.set(realm.id, newPerm);
		this.save();
	}

	static hashPassword(password: string): string {
		return bcrypt.hashSync(password, 10);
	}

	async save(): Promise<boolean> {
		await this.userManager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);
		return true;
	}

	public verifyPassword(password: string): boolean {
		if (!this.passwordHash) return true;
		return bcrypt.compareSync(password, this.passwordHash);
	}

	static checkPermission(
		user: User,
		permission: Permission,
		session?: Session,
		err = true
	) {
		if (!user.hasPermission(permission, session)) {
			if (err) throw Errors.forbidden([permission]);
			else return false;
		}
		return true;
	}

	static checkLink(
		user: User,
		session: Session,
		err: false
	): UserLink | false;
	static checkLink(user: User, session: Session, err?: true): UserLink;
	static checkLink(user: User, session: Session, err = true): unknown {
		const l = session.userLinkManager.getByUser(user);
		if (!l) {
			if (err)
				throw new TMError(
					`ENOSESSIONLINK`,
					`You can not perform actions in this sssion!`,
					{ sessionId: session.id }
				);
			else return false;
		}
		return l;
	}
}

class UserLink extends Resource {
	public readonly userId: string;
	public get user() {
		const u = this.session.client.userManager.get(this.userId);
		if (!u) throw new TMError(`EINTERNAL`);
		return u;
	}

	public get dispatching() {
		return this.session.stationLinkManager.links.find(
			(s) => s.dispatcher === this
		);
	}

	public get controlling() {
		return this.session.movableLinkManager.links.filter(
			(l) => l instanceof LocomotiveLink && l.controller === this
		);
	}

	constructor(options: UserLinkOptions) {
		super(`userlink`, options);

		this.userId = options.userId;
	}

	modify() {
		return false;
	}

	metadata(): UserLinkOptions {
		return {
			id: this.id,
			managerId: this.managerId,
			sessionId: this.sessionId,
			userId: this.userId,
		};
	}

	publicMetadata() {
		return this.metadata();
	}

	fullMetadata() {
		return this.metadata();
	}

	async save(): Promise<boolean> {
		await this.manager.db.redis.hset(this.managerId, [
			this.id,
			JSON.stringify(this.metadata()),
		]);
		return true;
	}
}

export {
	User,
	UserOptions,
	UserLinkOptions,
	UserSettings,
	PermissionMap,
	UserPermissions,
	UserPermissionsMetadata,
	Permission,
	UserConstructorOptions,
	UserLink,
};
