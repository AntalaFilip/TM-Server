import Collection from "@discordjs/collection";
import {
	BaseManager,
	Locomotive,
	LocomotiveLink,
	LocomotiveLinkOptions,
	Manager,
	Movable,
	MovableLink,
	MovableLinkOptions,
	MovableOptions,
	ResourceData,
	ResourceOptions,
	Session,
	SessionResourceManager,
	TMError,
	User,
	UserLink,
	Wagon,
	WagonLink,
	WagonLinkOptions,
	WagonOptions,
} from "../internal";

class MovableManager
	extends BaseManager
	implements ResourceData<MovableManager>
{
	public readonly movables: Collection<string, Movable>;
	public readonly ready: Promise<void>;

	constructor(client: Manager) {
		super(`movables`, client.io, client);

		this.movables = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.movables.size} movables`
				);
				res();
			});
		});
	}

	async create(
		resource: Movable | MovableOptions,
		actor?: User
	): Promise<Movable> {
		actor && User.checkPermission(actor, "manage movables");

		if (!(resource instanceof Movable)) {
			if (resource.type === "LOCOMOTIVE")
				resource = new Locomotive(resource);
			else if (resource.type === "WAGON")
				resource = new Wagon(resource as WagonOptions);
			else throw new TMError(`EINTERNAL`, `Bad resource type passed!`);
		}
		if (!(resource instanceof Movable)) {
			throw new TMError(`EINTERNAL`);
		}

		if (this.movables.has(resource.id))
			throw new Error(`This Movable is already created!`);

		this.movables.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	get(id: string, error: true): Movable;
	get(id: string, error?: boolean): Movable | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.movables.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}
	getOne(id: string) {
		return this.get(id)?.fullMetadata();
	}
	getAll() {
		return this.movables.map((m) => m.fullMetadata());
	}

	getLoco(id: string, error: true): Locomotive;
	getLoco(id: string, error?: boolean): Locomotive | undefined;
	getLoco(id: string, error?: boolean): unknown {
		const l = this.movables.get(id);
		if ((!l || !(l instanceof Locomotive)) && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}

	getWagon(id: string, error: true): Wagon;
	getWagon(id: string, error?: boolean): Wagon | undefined;
	getWagon(id: string, error?: boolean): unknown {
		const l = this.movables.get(id);
		if ((!l || !(l instanceof Wagon)) && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}

	private async createAllFromStore() {
		const allMovables = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allMovables);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as MovableOptions;

				const movable =
					v.type === "LOCOMOTIVE"
						? new Locomotive(v)
						: new Wagon(v as WagonOptions);
				this.movables.set(k, movable);
			} catch {
				this.logger.warn(`Malformed movable data @ ${r[0]}`);
			}
		}

		return true;
	}

	async fromResourceIdentifier(
		id: string
	): Promise<Locomotive | Wagon | undefined> {
		const movableData = await this.db.redis.hget(this.id, id);
		if (!movableData) return;

		try {
			const movableMeta = JSON.parse(movableData) as MovableOptions;
			if (movableMeta.type === "WAGON") {
				return new Wagon(movableMeta as WagonOptions);
			} else if (movableMeta.type === "LOCOMOTIVE") {
				return new Locomotive(movableMeta);
			}
		} catch {
			this.logger.warn(`Malformed movable data @ ${id}`);
			return;
		}
	}
}

class MovableLinkManager extends SessionResourceManager {
	public readonly links: Collection<string, MovableLink>;
	public readonly ready: Promise<void>;

	constructor(session: Session) {
		super(session, `movablelinks`);

		this.links = new Collection();

		this.ready = new Promise((res) => {
			this.createAllFromStore().then(() => {
				this.logger.debug(
					`Ready; loaded ${this.links.size} movablelinks`
				);
				res();
			});
		});
	}

	async create(
		resource: MovableLink | MovableLinkOptions,
		actor?: UserLink
	): Promise<MovableLink> {
		actor && User.checkPermission(actor.user, "manage movables");

		if (!(resource instanceof MovableLink)) {
			if (resource.type === "locomotivelink")
				resource = new LocomotiveLink(
					resource as LocomotiveLinkOptions
				);
			else if (resource.type === "wagonlink")
				resource = new WagonLink(resource as WagonLinkOptions);
			else throw new TMError(`EINTERNAL`, `Bad resource type passed!`);
		}
		if (!(resource instanceof MovableLink)) {
			throw new TMError(`EINTERNAL`);
		}

		if (this.links.has(resource.id))
			throw new Error(`This movablelink is already created!`);

		this.links.set(resource.id, resource);
		await resource.save();
		return resource;
	}

	get(id: string, error: true): MovableLink;
	get(id: string): MovableLink | undefined;
	get(id: string, error?: boolean): unknown {
		const l = this.links.get(id);
		if (!l && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}
	getOne(id: string): ResourceOptions<SessionResourceManager> | undefined {
		return this.get(id)?.fullMetadata();
	}
	getAll(): ResourceOptions<SessionResourceManager>[] {
		return this.links.map((m) => m.fullMetadata());
	}

	getLocoLink(id: string, error: true): LocomotiveLink;
	getLocoLink(id: string): LocomotiveLink | undefined;
	getLocoLink(id: string, error?: boolean): unknown {
		const l = this.links.get(id);
		if ((!l || !(l instanceof LocomotiveLink)) && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}
	getWagonLink(id: string, error: true): WagonLink;
	getWagonLink(id: string): WagonLink | undefined;
	getWagonLink(id: string, error?: boolean): unknown {
		const l = this.links.get(id);
		if ((!l || !(l instanceof WagonLink)) && error)
			throw new TMError(`EINVALIDINPUT`, `Invalid input ID!`);
		return l;
	}

	getByLocomotive(loco: Locomotive): LocomotiveLink | undefined {
		const l = this.links.find(
			(l) => l instanceof LocomotiveLink && l.locomotive === loco
		) as LocomotiveLink | undefined;
		return l;
	}
	getByWagon(wagon: Wagon): WagonLink | undefined {
		const w = this.links.find(
			(l) => l instanceof WagonLink && l.wagon === wagon
		) as WagonLink | undefined;
		return w;
	}

	private async createAllFromStore() {
		const allLinks = await this.db.redis.hgetall(this.id);
		const arr = Object.entries(allLinks);
		for (const r of arr) {
			try {
				const k = r[0];
				const v = JSON.parse(r[1]) as MovableLinkOptions;

				const movable =
					v.type === "locomotivelink"
						? new LocomotiveLink(v as LocomotiveLinkOptions)
						: new WagonLink(v as WagonLinkOptions);
				this.links.set(k, movable);
			} catch {
				this.logger.warn(`Malformed movablelink data @ ${r[0]}`);
			}
		}

		return true;
	}

	async fromResourceIdentifier(
		id: string
	): Promise<LocomotiveLink | WagonLink | undefined> {
		const movableData = await this.db.redis.hget(this.id, id);
		if (!movableData) return;

		try {
			const movableMeta = JSON.parse(movableData) as MovableLinkOptions;
			if (movableMeta.type === "wagonlink") {
				return new WagonLink(movableMeta as WagonLinkOptions);
			} else if (movableMeta.type === "locomotivelink") {
				return new LocomotiveLink(movableMeta as LocomotiveLinkOptions);
			}
		} catch {
			this.logger.warn(`Malformed movablelink data @ ${id}`);
			return;
		}
	}
}

export { MovableManager, MovableLinkManager };
