import Resource, { ResourceOptions } from "./resource";
import bcrypt from "bcrypt";
import BaseManager from "../managers/BaseManager";
import UserManager from "../managers/UserManager";
import Realm from "./realm";
import Locomotive from "./locomotive";
import crypto from "crypto";

interface UserOptions extends UserPublicData {
	passwordHash?: string;
	settings?: UserSettings;
	realmId: null;
	email: string;
}

type UserConstructorOptions = Omit<UserOptions, "id" | "emailMD5"> & {
	id?: string;
};

interface UserPublicData extends Omit<ResourceOptions, "realmId"> {
	id: string;
	name: string;
	emailMD5: string;
	username: string;
	disabled?: boolean;
	admin?: boolean;
	realmId: null;
	permissions?: UserPermissionsMetadata;
	dispatching?: { realm: string; station: string };
	controlling?: { realm: string; locomotive: string }[];
	owning?: string[];
}

interface UserPermissions {
	global: number;
	readonly realm: Map<string, number>;
}

interface UserPermissionsMetadata {
	global: number;
	realm: [string, number][];
}

type Permission = keyof typeof PermissionMap;

const PermissionMap = {
	"manage realm": 1 << 0,
	"manage users": 1 << 1,
	"manage stations": 1 << 2,
	"manage movables": 1 << 3,
	"manage time": 1 << 4,
	"control time": 1 << 5,
	"assign users": 1 << 6,
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

	public get controlling() {
		return Array.from(this.userManager.client.realms.values())
			.flatMap(
				(r) =>
					Array.from(
						r.movableManager.movables
							.filter((v) => v instanceof Locomotive)
							.values()
					) as Locomotive[]
			)
			.filter((m) => m.controller === this);
	}

	public get owning() {
		return Array.from(this.userManager.client.realms.values()).filter(
			(r) => r.owner === this
		);
	}

	public get dispatching() {
		return this.userManager.client.realms
			.flatMap((r) => r.stationManager.stations)
			.find((s) => s.dispatcher === this);
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
			realm: new Map(options.permissions?.realm),
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
			realmId: null,
			passwordHash: this.passwordHash,
			settings: this.settings,
			disabled: this.disabled,
			admin: this.admin,
			permissions: this.permissionMeta(),
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
			const realm = actor.manager.client.realms.get(data.realmId);
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
			realmId: this.realmId,
			dispatching: this.dispatching
				? {
						realm: this.dispatching.realmId,
						station: this.dispatching.id,
				  }
				: undefined,
			controlling: this.controlling.map((c) => ({
				realm: c.realmId,
				locomotive: c.id,
			})),
			owning: this.owning.map((r) => r.id),
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
			realm: Array.from(this.permissions?.realm.entries()),
		};
	}

	hasPermission(perm: Permission, realm?: Realm): boolean {
		return (
			perm === null ||
			(this.permissions.global & PermissionMap[perm]) ===
				PermissionMap[perm] ||
			(realm &&
				((this.permissions.realm.get(realm.id) ?? 0) &
					PermissionMap[perm]) ===
					PermissionMap[perm]) ||
			realm?.owner === this ||
			this.admin
		);
	}

	public adjustGlobalPermissions(newPerm: number) {
		this.permissions.global = newPerm;
		this.save();
	}

	public adjustRealmPermissions(realm: Realm, newPerm: number) {
		this.permissions.realm.set(realm.id, newPerm);
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
}

export default User;
export {
	UserOptions,
	UserSettings,
	PermissionMap,
	UserPermissions,
	UserPermissionsMetadata,
	Permission,
	UserConstructorOptions,
};
