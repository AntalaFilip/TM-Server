import {
	LocomotiveLink,
	Resource,
	ResourceOptions,
	TMError,
	Train,
	WagonLink,
} from "../internal";

type ActionSubject = Train | LocomotiveLink | WagonLink;
type ActionSubjectType = ActionSubject["type"];

interface ActionOptions extends ResourceOptions {
	from: Date;
	to: Date;

	subjectId: string;
	subjectType: ActionSubjectType;
	cancelledReason?: string;
}

abstract class Action<S extends ActionSubject> extends Resource {
	private _from: Date;
	public get from() {
		return this._from;
	}
	protected set from(date: Date) {
		this._from = date;
		this.propertyChange("from", date);
	}
	private _to: Date;
	public get to() {
		return this._to;
	}
	protected set to(date: Date) {
		this._to = date;
		this.propertyChange("to", date);
	}

	private _cancelledReason?: string;
	public get cancelledReason() {
		return this._cancelledReason;
	}
	protected set cancelledReason(reason: string | undefined) {
		this._cancelledReason = reason;
		this.propertyChange("cancelledReason", reason);
	}
	public get cancelled() {
		return Boolean(this._cancelledReason);
	}

	abstract readonly usable: boolean;

	public readonly subjectId: string;
	public readonly subjectType: ActionSubjectType;
	public get subject(): S {
		switch (this.subjectType) {
			case "train": {
				const s = this.session.trainManager.get(this.subjectId);
				if (s) return s as S;
				else throw new TMError(`EINTERNAL`);
			}
			case "locomotivelink": {
				const l = this.session.movableLinkManager.getLocoLink(
					this.subjectId
				);
				if (l) return l as S;
				else throw new TMError(`EINTERNAL`);
			}
			case "wagonlink": {
				const w = this.session.movableLinkManager.getWagonLink(
					this.subjectId
				);
				if (w) return w as S;
				else throw new TMError(`EINTERNAL`);
			}
		}
	}

	constructor(type: string, options: ActionOptions) {
		super(type, options);

		this._from = options.from;
		this._to = options.to;

		this.subjectId = options.subjectId;
		this.subjectType = options.subjectType;
	}
}

export { Action };
