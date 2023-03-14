import { SessionSpecificResourceDataOptions } from "./SessionSpecificResourceDataOptions";
import { MovableLocationMeta } from "../types/Movable";

export interface SessionSpecificMovableDataOptions
	extends SessionSpecificResourceDataOptions {
	currentLocation?: MovableLocationMeta;
}
