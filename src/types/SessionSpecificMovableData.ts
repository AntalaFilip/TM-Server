import { ForbiddenError } from "apollo-server-core";
import { SessionSpecificResourceData } from "./SessionSpecificResourceData";
import Train from "./Train";
import User from "./User";
import { Movable, MovableLocation } from "./Movable";
import { SessionSpecificMovableDataOptions } from "../interfaces/SessionSpecificMovableDataOptions";


export abstract class SessionSpecificMovableData<R extends Movable> extends SessionSpecificResourceData<R> {
	public sessionData: undefined;

	private _currentLocation?: MovableLocation;
	/** The Station in which the object is currently located */
	public get currentLocation() {
		return this._currentLocation;
	}
	private set currentLocation(location: MovableLocation | undefined) {
		// there can't be a track without a station as tracks are tied to stations :)
		if (location && !location.station && location.track)
			location.track = undefined;

		this._currentLocation = location;
		this.propertyChange("currentLocation", this.currentLocation);
	}

	abstract currentTrain?: Train;

	constructor(
		type: string,
		options: SessionSpecificMovableDataOptions,
		resource: R
	) {
		super(type, options, resource);

		const curSt = options.currentLocation &&
			this.realm.stationManager.get(options.currentLocation.stationId);
		this._currentLocation = curSt &&
			options.currentLocation && {
			station: curSt,
			track: options.currentLocation.trackId
				? curSt.tracks.get(options.currentLocation.trackId)
				: undefined,
		};
	}

	_modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage movables", this.realm))
			throw new ForbiddenError(`No permission`, {
				permission: `manage movables`,
			});
		let modified = false;

		const stat = typeof data.currentStationId === "string"
			? this.realm.stationManager.get(data.currentStationId)
			: undefined;
		if (stat) {
			this.currentLocation = {
				...this.currentLocation,
				station: stat,
			};
			modified = true;
		}
		if (typeof data.currentTrackId === "string" &&
			this.currentLocation?.station.tracks.get(data.currentTrackId)) {
			this.currentLocation = {
				...this.currentLocation,
				track: this.currentLocation.station.tracks.get(
					data.currentTrackId
				),
			};
			modified = true;
		}

		return modified;
	}

	async save() {
		this.instanceManager.db.redis.hset(this.instanceManager.id, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}
