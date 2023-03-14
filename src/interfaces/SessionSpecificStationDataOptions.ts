import { SessionSpecificResourceDataOptions } from "./SessionSpecificResourceDataOptions";
import User from "../types/User";


export interface SessionSpecificStationDataOptions
	extends SessionSpecificResourceDataOptions {
	dispatcher?: User;
}
