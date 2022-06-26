import crypto from 'crypto';

function newUUID(): string {
	return crypto.randomUUID();
}

export { newUUID };