import { ResourceOptions } from "../types/Resource";
import { SessionManager } from "../managers/SessionManager";

export interface SessionSpecificResourceDataOptions
	extends ResourceOptions<SessionManager> {
	sessionId: string;
}
