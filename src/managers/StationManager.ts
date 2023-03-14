import Collection from "@discordjs/collection";
import { ForbiddenError } from "apollo-server-core";
import Realm from "../types/Realm";
import Station, { StationOptions } from "../types/Station";
import StationTrack, { StationTrackOptions } from "../types/Track";
import User from "../types/User";
import ResourceManager from "./ResourceManager";

class StationManager extends ResourceManager {
	public readonly stations: Collection<string, Station>;
	public readonly ready: Promise<void>;

	constructor(realm: Realm) {
		super(realm, "stations");

		this.stations = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.stations.size} stations`
				);
				res();
			});
		});
	}

	get(id: string): Station | undefined {
		return this.stations.get(id);
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.stations.map((s) => s.fullMetadata());
	}

	async create(
		resource: Station | StationOptions,
		actor?: User
	): Promise<Station> {
		if (actor && !actor.hasPermission("manage stations", this.realm))
			throw new ForbiddenError("No permission!", {
				tmCode: `ENOPERM`,
				permission: `manage stations`,
			});

		if (!(resource instanceof Station)) {
			resource = new Station(resource);
		}

		if (this.stations.has(resource.id))
			throw new Error(`This Station is already created!`);

		this.stations.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	async fromResourceIdentifier(fullId: string): Promise<Station | undefined> {
		if (!(await this.db.redis.exists(fullId, `${fullId}:tracks`))) return;

		const stationMeta = (await this.db.get(fullId)) as StationOptions;
		const trackData = await this.db.redis.hgetall(`${fullId}:tracks`);
		const trackMeta = new Collection(Object.entries(trackData)).map(
			(meta) => JSON.parse(meta) as StationTrackOptions
		);
		stationMeta.tracks = trackMeta.map(
			(options) => new StationTrack(options)
		);

		return new Station(stationMeta);
	}

	private async createAllFromStore() {
		const allStations = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allStations);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as StationOptions;
				const trackData = await this.db.redis.hgetall(
					`${this.key(k)}:tracks`
				);
				const tracks = Object.entries(trackData)
					.map(([_k, v]) => JSON.parse(v) as StationTrackOptions)
					.map((meta) => new StationTrack(meta));
				v.tracks = tracks;

				await this.create(v);
			} catch (err) {
				this.logger.warn(`Malformed station data @ ${r[0]}`);
				if (err instanceof Error) this.logger.verbose(err.message);
			}
		}

		return true;
	}
}

export default StationManager;
