class TMError extends Error {
	code: string;
	extension?: unknown;

	constructor(code: string, message?: string, extension?: unknown) {
		super(message ?? code);

		this.code = code;
		this.extension = extension;
	}
}

export default TMError;