import { nanoid } from "nanoid";

function newUUID(): string {
	return nanoid();
}

export { newUUID };