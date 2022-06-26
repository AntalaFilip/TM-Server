import Collection from "@discordjs/collection";
import Realm from "../types/realm";
import Station, { StationOptions } from "../types/station";
import StationTrack, { StationTrackOptions } from "../types/track";
import ResourceManager from "./ResourceManager";

class StationManager extends ResourceManager {
	public readonly stations: Collection<string, Station>;
	public readonly ready: Promise<void>;

	constructor(realm: Realm) {
		super(realm, 'stations');

		this.stations = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore()
				.then(() => {
					console.log(`StationManager (${this.id}) ready; loaded ${this.stations.size} stations`);
					res();
				});
		})
	}

	get(id: string): Station {
		return this.stations.get(id);
	}

	async create(resource: Station | StationOptions): Promise<Station> {
		if (!(resource instanceof Station)) {
			resource = new Station(resource);
		}

		if (this.stations.has(resource.id)) throw new Error(`This Station is already created!`);

		this.stations.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	async fromResourceIdentifier(fullId: string): Promise<Station> {
		if (!await this.db.redis.exists(fullId, `${fullId}:tracks`)) return;

		const stationMeta = await this.db.get(fullId) as StationOptions;
		const trackData = await this.db.redis.hgetall(`${fullId}:tracks`);
		const trackMeta = new Collection(Object.entries(trackData)).map(meta => JSON.parse(meta) as StationTrackOptions);
		stationMeta.tracks = trackMeta.map(options => new StationTrack(options));

		return new Station(stationMeta);
	}

	private async createAllFromStore() {
		const allStationIds = await this.db.redis.keys(`${this.id}*:`);
		if (!allStationIds || allStationIds.length === 0) return;

		const allStations = await this.db.redis.mget(allStationIds);
		const arr = allStationIds.map((v, i) => [v, allStations[i]]);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as StationOptions;
				const trackData = await this.db.redis.hgetall(`${k}:tracks`);
				const tracks = Object.entries(trackData).map(([_k, v]) => JSON.parse(v) as StationTrackOptions).map(meta => new StationTrack(meta));
				v.tracks = tracks;
				await this.create(v);
			}
			catch {
				console.warn(`Malformed station data @ ${r[0]}`)
			}
		}

		return true;
	}
}

export default StationManager;