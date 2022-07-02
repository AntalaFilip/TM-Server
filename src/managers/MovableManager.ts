import Collection from "@discordjs/collection";
import Locomotive from "../types/locomotive";
import Movable, { MovableOptions } from "../types/movable";
import Realm from "../types/realm";
import User from "../types/user";
import Wagon, { WagonOptions } from "../types/wagon";
import ResourceManager from "./ResourceManager";

class MovableManager extends ResourceManager {
	public readonly movables: Collection<string, Movable>;
	public readonly ready: Promise<void>;

	constructor(realm: Realm) {
		super(realm, 'movable');

		this.movables = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore()
				.then(() => {
					console.log(`MovableManager (${this.id}) ready; loaded ${this.movables.size} movables`);
					res();
				});
		});
	}

	async create(resource: Movable | MovableOptions, actor?: User): Promise<Movable> {
		if (actor && !actor.hasPermission('manage movables', this.realm)) throw new Error('No permission!');

		if (!(resource instanceof Movable)) {
			if (resource.type === 'locomotive') resource = new Locomotive(resource);
			else if (resource.type === 'wagon') resource = new Wagon(resource as WagonOptions);
			return;
		}

		if (this.movables.has(resource.id)) throw new Error(`This Movable is already created!`);

		this.movables.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	get(id: string): Movable {
		return this.movables.get(id);
	}

	getLoco(id: string): Locomotive {
		const obj = this.get(id);
		if (!obj || !Locomotive.is(obj)) return;
		return obj;
	}

	getWagon(id: string): Wagon {
		const obj = this.get(id);
		if (!obj || !Wagon.is(obj)) return;
		return obj;
	}

	private async createAllFromStore() {
		const allMovables = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allMovables);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as MovableOptions;

				const movable = v.type === 'locomotive' ? new Locomotive(v) : new Wagon(v as WagonOptions);
				this.movables.set(k, movable);
			}
			catch {
				console.warn(`Malformed movable data @ ${r[0]}`)
			}
		}

		return true;
	}

	async fromResourceIdentifier(id: string): Promise<Locomotive | Wagon> {
		const movableData = await this.db.redis.hget(this.id, id);
		if (!movableData) return;

		try {
			const movableMeta = JSON.parse(movableData) as MovableOptions;
			if (movableMeta.type === 'wagon') {
				return new Wagon(movableMeta as WagonOptions);
			}
			else if (movableMeta.type === 'locomotive') {
				return new Locomotive(movableMeta);
			}
		}
		catch {
			console.warn(`Malformed movable data @ ${id}`);
			return;
		}
	}
}

export default MovableManager;