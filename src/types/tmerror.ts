import { Permission, User } from "../internal";

class TMError extends Error {
	code: string;
	extension?: Record<string, unknown>;

	constructor(
		code: string,
		message?: string,
		extension?: Record<string, unknown>
	) {
		super(message ?? code);

		this.code = code;
		this.extension = extension;
	}
}

const Errors = {
	forbidden: (perm?: Permission[], user?: User) =>
		new TMError(
			`EFORBIDDEN`,
			`You do not have sufficient permissions to perform this action!`,
			{ permission: perm, user: user?.publicMetadata() }
		),
	unauth: () =>
		new TMError(
			`ENOAUTH`,
			`You must be authenticated to perform this action!`
		),
};

export { TMError, Errors };
