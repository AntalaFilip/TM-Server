import Resource from "./Resource";
import Session from "./Session";
import TMError from "./TMError";
import ResourceManager from "../managers/ResourceManager";
import { SessionManager } from "../managers/SessionManager";
import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";

export abstract class SessionSpecificResourceData<
	R extends Resource = Resource> extends Resource<SessionManager> {
	public readonly managerId: string;
	public readonly sessionId: string;
	public readonly resource: R;

	public get manager(): SessionManager {
		const m = ResourceManager.get(this.managerId);
		if (!m || !(m instanceof SessionManager))
			throw new Error("bad manager");
		return m;
	}

	public get instanceManager() {
		return this.resource.sessionData;
	}

	public get session(): Session {
		const s = this.manager.get(this.sessionId);
		if (!s)
			throw new TMError(`EINTERNAL`, `Invalid Session ID provided!`);
		return s;
	}

	constructor(
		type: string,
		options: SessionSpecificResourceDataOptions,
		resource: R
	) {
		super(type, options);
		this.managerId = options.managerId;
		this.sessionId = options.sessionId;
		this.resource = resource;
	}

	abstract metadata(): SessionSpecificResourceDataOptions;
}
