import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import { SessionSpecificStationDataOptions } from "../interfaces/SessionSpecificStationDataOptions";
import { SessionSpecificDataManager } from "../managers/SessionSpecificDataManager";
import { SessionSpecificStationData } from "./SessionSpecificStationData";
import { Station } from "./Station";

export class SessionSpecificStationDataManager extends SessionSpecificDataManager<Station> {
	instantiate(
		opts: SessionSpecificResourceDataOptions,
		resource: Station
	): SessionSpecificStationData {
		return new SessionSpecificStationData(opts, resource);
	}
	protected override async createAllFromStore() {
		const allSessionData = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allSessionData);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as SessionSpecificStationDataOptions;

				// If the server was interrupted during a dispatch session, we can find and restore the dispatcher to the station
				const dispd = await this.db.redis.xrevrange(
					this.key(`${k}:dispatchers`),
					"+",
					"-",
					"COUNT",
					1
				);
				const lastDisp = dispd[0];
				if (lastDisp && lastDisp[1]) {
					const id = lastDisp[1][1];
					const type = lastDisp[1][3];
					if (type === "user" && id) {
						const u = this.client.userManager.get(id);
						if (u) {
							v.dispatcher = u;
						}
					}
				}

				await this.create(v);
			} catch (err) {
				this.logger.warn(`Malformed station data @ ${r[0]}`);
				if (err instanceof Error) this.logger.verbose(err.message);
			}
		}
	}
}
