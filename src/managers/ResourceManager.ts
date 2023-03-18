import {
	BaseManager,
	ManagerType,
	Resource,
	ResourceContructorOptions,
	ResourceOptions,
	Session,
	TMLogger,
	UserLink,
} from "../internal";

const managers = new Map<string, SessionResourceManager>();

interface ResourceData<M extends ManagerType = SessionResourceManager> {
	fromResourceIdentifier(
		fullId: string
	): Resource<M> | undefined | Promise<Resource<M> | undefined>;
	create(
		resource: Resource<M> | ResourceContructorOptions<M>
	): Resource<M> | Promise<Resource<M>>;
	getOne(id: string): ResourceOptions<M> | undefined;
	getAll(): ResourceOptions<M>[];
	get(id: string): Resource<M> | undefined;
}

abstract class SessionResourceManager
	extends BaseManager
	implements ResourceData
{
	readonly session: Session;
	readonly type: string;
	override readonly logger: TMLogger;

	constructor(session: Session, type: string) {
		super(
			`sessions:${session.id}:${type}`,
			session.ionsp.server,
			session.client
		);
		this.session = session;
		this.type = type;
		this.logger = new TMLogger(
			`${this.type.toUpperCase()}:${this.session.id}`,
			`${this.type.toUpperCase()}:${this.session.shortId}`
		);

		managers.set(this.id, this);
	}

	static get(id: string, err?: true): SessionResourceManager;
	static get(id: string, err: false): SessionResourceManager | undefined;
	static get(id: string, err = true): unknown {
		const manager = managers.get(id);
		if (!manager && err) throw new Error("Invalid manager");
		return manager;
	}

	abstract fromResourceIdentifier(
		fullId: string
	): Resource | undefined | Promise<Resource | undefined>;

	abstract get(id: string): Resource | undefined;

	abstract getOne(id: string): ResourceOptions | undefined;
	abstract getAll(): ResourceOptions[];

	abstract create(
		resource: Resource | ResourceContructorOptions,
		actor?: UserLink
	): Resource | Promise<Resource>;
}

export { SessionResourceManager, ResourceData };
