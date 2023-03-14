import { SessionSpecificResourceData } from "./SessionSpecificResourceData";
import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import Train from "./Train";
import StationTrack from "./Track";

class SessionSpecificStationTrackData extends SessionSpecificResourceData {
	modify() {
		return false;
	}
	publicMetadata() {
		return {
			id: this.id,
			managerId: this.managerId,
			realmId: this.realmId,
			sessionId: this.sessionId,
		};
	}
	metadata() {
		return this.publicMetadata();
	}
	fullMetadata() {
		return this.metadata();
	}
	public sessionData: undefined;

	constructor(
		options: SessionSpecificResourceDataOptions,
		resource: StationTrack
	) {
		super("sessionspecific-track", options, resource);
	}

	public get currentTrain(): Train | undefined {
		return this.realm.trainManager.trains.find(
			(t) =>
				t.sessionData.get(this.sessionId)?.location?.track ===
				this.resource
		);
	}

	public async save() {
		await this.instanceManager.db.redis.hset(this.instanceManager.id, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}
export { SessionSpecificStationTrackData };
