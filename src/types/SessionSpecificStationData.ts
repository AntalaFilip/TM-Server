import { ForbiddenError } from "apollo-server-core";
import { SessionSpecificResourceData } from "./SessionSpecificResourceData";
import { SessionSpecificResourceDataOptions } from "../interfaces/SessionSpecificResourceDataOptions";
import { SessionSpecificStationDataOptions } from "../interfaces/SessionSpecificStationDataOptions";
import { Station } from "./Station";
import TMError from "./TMError";
import Train from "./Train";
import User from "./User";

export class SessionSpecificStationData extends SessionSpecificResourceData<Station> {
	private _dispatcher?: User;
	public get dispatcher() {
		return this._dispatcher;
	}
	private set dispatcher(disp: User | undefined) {
		this._dispatcher = disp;
		const trueTimestamp = this.session.timeManager.trueMs;
		this.instanceManager.db.redis.xadd(
			this.instanceManager.key(`${this.resource.id}:dispatchers`),
			"*",
			"id",
			disp?.id ?? "",
			"type",
			disp?.type ?? "",
			"time",
			trueTimestamp
		);
		this.resource.propertyChange(`dispatcherId`, disp?.id);
	}

	public sessionData = undefined;

	public get trains(): Train[] {
		return Array.from(
			this.manager.realm.trainManager.trains
				.filter(
					(t) => t.sessionData.get(this.sessionId)?.location?.station ===
						this.resource
				)
				.values()
		);
	}

	constructor(options: SessionSpecificStationDataOptions, resource: Station) {
		super("sessionspecific-station", options, resource);

		this._dispatcher = options.dispatcher;
	}
	setDispatcher(newDisp: User | undefined, actor: User) {
		const self = actor.hasPermission("assign self");
		const others = actor.hasPermission("assign users");
		// Oh this mess... and it should've been so easy
		if (
			// Negate the result, as it's the other way round
			!(
				// If is self (start), or is self (end) and has permissions
				(
					((newDisp === actor ||
						(newDisp == undefined && this.dispatcher === actor)) &&
						(self || others)) ||
					// Or just has permissions to modify others
					others
				)
			))
			throw new ForbiddenError(`No permission`, {
				permission: "assign self XOR assign users",
			});

		const already = newDisp?.dispatching;
		if (already)
			throw new TMError(
				`EALREADYDISPATCHING`,
				`User is already dispatching in another station!`,
				{ station: already.id }
			);

		if (newDisp === this.dispatcher)
			return;
		this.dispatcher = newDisp;

		return true;
	}

	modify(data: Record<string, unknown>, actor: User) {
		if (!actor.hasPermission("manage stations", this.realm))
			throw new ForbiddenError(`No permission`, {
				permission: `manage stations`,
			});
		let modified = false;

		// TODO: auditing
		if (typeof data.dispatcherId === "string" &&
			this.realm.client.userManager.get(data.dispatcherId)) {
			this.setDispatcher(
				this.realm.client.userManager.get(data.dispatcherId),
				actor
			);
			modified = true;
		}

		if (!modified)
			return false;
		return true;
	}

	publicMetadata(): SessionSpecificResourceDataOptions {
		return {
			managerId: this.managerId,
			id: this.id,
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

	async save() {
		await this.instanceManager.db.redis.hset(this.instanceManager.id, [
			this.id,
			JSON.stringify(this.metadata()),
		]);

		return true;
	}
}
