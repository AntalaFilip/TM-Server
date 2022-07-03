import Resource, { ResourceOptions } from "./resource";
import bcrypt from 'bcrypt';
import BaseManager from "../managers/BaseManager";
import UserManager from "../managers/UserManager";
import Realm from "./realm";

interface UserOptions extends ResourceOptions, UserPublicData {
	passwordHash?: string,
	settings?: UserSettings,
	realmId: null,
}

interface UserPublicData {
	id?: string,
	name: string,
	username: string,
	disabled?: boolean,
	admin?: boolean,
	permissions?: UserPermissionsMetadata,
}

interface UserPermissions {
	global: number,
	readonly realm: Map<string, number>,
}

interface UserPermissionsMetadata {
	global: number,
	realm: [string, number][],
}

type Permission = 'manage realm' | 'manage users' | 'manage stations' | 'manage movables' | 'manage time' | 'control time' | 'assign users';

const PermissionMap = {
	'manage realm': 1 << 0,
	'manage users': 1 << 1,
	'manage stations': 1 << 2,
	'manage movables': 1 << 3,
	'manage time': 1 << 4,
	'control time': 1 << 5,
	'assign users': 1 << 6,
};

interface UserSettings {
	theme?: string,
}

class User extends Resource {
	private _name: string;
	public get name() { return this._name; }
	private set name(newName: string) {
		this._name = newName;
		this.propertyChange('name', this.name);
	}

	private _username: string;
	public get username() { return this._username; }
	private set username(username: string) {
		this._username = username;
		this.propertyChange('username', this.username);
	}

	private _passwordHash: string;
	private get passwordHash() { return this._passwordHash; }
	private set passwordHash(hash: string) {
		this._passwordHash = hash;
		this.save();
	}
	public get hasPassword() { return Boolean(this.passwordHash); }

	private _disabled: boolean;
	public get disabled() { return this._disabled; }
	private set disabled(state: boolean) {
		this._disabled = state;
		this.save();
	}

	private _admin: boolean;
	public get admin() { return this._admin; }
	private set admin(state: boolean) {
		this._admin = state;
		this.save();
	}

	private readonly permissions: UserPermissions;

	public readonly settings: UserSettings;
	public get userManager() { return BaseManager.get(`users`) as UserManager; }

	constructor(options: UserOptions) {
		options.managerId = 'users';
		super('user', options);

		this._name = options.name;
		this._username = options.username;
		this._passwordHash = options.passwordHash;
		this._admin = options.admin ?? false;
		this.permissions = { global: options.permissions?.global ?? 0b0, realm: new Map(options.permissions?.realm) };
		this.settings = options.settings ?? {};
		this.disabled = options.disabled ?? false;
	}

	metadata(): UserOptions {
		return {
			id: this.id,
			name: this.name,
			username: this.username,
			managerId: this.managerId,
			realmId: null,
			passwordHash: this.passwordHash,
			settings: this.settings,
			disabled: this.disabled,
			admin: this.admin,
			permissions: this.permissionMeta(),
		};
	}

	publicMetadata(): UserPublicData {
		return {
			name: this.name,
			username: this.username,
			admin: this.admin,
			disabled: this.disabled,
			id: this.id,
			permissions: this.permissionMeta(),
		}
	}

	permissionMeta(): UserPermissionsMetadata {
		return {
			global: this.permissions?.global,
			realm: Array.from(this.permissions?.realm.entries())
		}
	}

	hasPermission(perm: Permission, realm?: Realm): boolean {
		return (
			(this.permissions.global & PermissionMap[perm]) === PermissionMap[perm]
			|| (this.permissions.realm.get(realm?.id) & PermissionMap[perm]) === PermissionMap[perm]
			|| realm?.owner === this
			|| this.admin
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
		await this.userManager.db.redis.hset(this.managerId, [this.id, JSON.stringify(this.metadata())]);
		return true;
	}

	public verifyPassword(password: string): boolean {
		if (!this.passwordHash) return true;
		return bcrypt.compareSync(password, this.passwordHash);
	}
}

export default User;
export { UserOptions, UserSettings, PermissionMap, UserPermissions, UserPermissionsMetadata, Permission };