import {
	DateScalar,
	Errors,
	firstCapital,
	Locomotive,
	LocomotiveLink,
	Manager,
	Movable,
	newUUID,
	Station,
	StationLink,
	TimetableEntry,
	TMError,
	TrainSet,
	TrainState,
	User,
	Wagon,
	WagonLink,
} from "./internal";

type GQLContext = {
	user?: User;
};

const resolvers = {
	Date: DateScalar,
	Station: {
		tracks: (parent: Station) => Array.from(parent.tracks.values()),
	},
	StationLink: {
		trackLinks: (parent: StationLink) =>
			Array.from(parent.trackLinks.values()),
	},
	Movable: {
		__resolveType: (obj: Movable) => firstCapital(obj.type),
	},
	User: {
		email: (parent: User, _a: never, ctx: GQLContext) =>
			ctx.user?.hasPermission("manage users") || ctx.user === parent
				? parent.email
				: null,
	},
	TrainSet: {
		// TODO: move to TrainSet
		trains: (parent: TrainSet) =>
			parent.session.trainManager.trains.filter((t) =>
				t.trainSets.includes(parent)
			),
	},
	Query: {
		stations: async (p: Manager) => {
			return Array.from(p.stationManager.stations.values());
		},
		station: async (p: Manager, a: { id: string }) => {
			return p.stationManager.get(a.id);
		},
		stationLinks: async (p: Manager, a: { session: string }) => {
			return Array.from(
				p.get(a.session)?.stationLinkManager.links.values() ?? []
			);
		},
		stationLink: async (p: Manager, a: { id: string; session: string }) => {
			return p.get(a.session)?.stationLinkManager.get(a.id);
		},

		trains: async (p: Manager, a: { session: string }) => {
			return Array.from(
				p.get(a.session)?.trainManager.trains.values() ?? []
			);
		},
		train: async (p: Manager, a: { session: string; id: string }) => {
			return p.get(a.session)?.trainManager.get(a.id);
		},

		trainSets: async (p: Manager, a: { session: string }) => {
			return Array.from(
				p.get(a.session)?.trainSetManager.trainsets.values() ?? []
			);
		},
		trainSet: async (p: Manager, a: { session: string; id: string }) => {
			return p.get(a.session)?.trainSetManager.get(a.id);
		},

		locomotives: async (p: Manager) => {
			return Array.from(
				p.movableManager.movables
					.filter((m) => m instanceof Locomotive)
					.values()
			);
		},
		locomotive: async (p: Manager, a: { id: string }) => {
			return p.movableManager.getLoco(a.id);
		},
		locomotiveLinks: async (p: Manager, a: { session: string }) => {
			return Array.from(
				p
					.get(a.session)
					?.movableLinkManager.links.filter(
						(l) => l instanceof LocomotiveLink
					)
					.values() ?? []
			);
		},
		locomotiveLink: async (
			p: Manager,
			a: { id: string; session: string }
		) => {
			return p.get(a.session)?.movableLinkManager.getLocoLink(a.id);
		},

		wagons: async (p: Manager) => {
			return Array.from(
				p.movableManager.movables
					.filter((m) => m instanceof Wagon)
					.values() ?? []
			);
		},
		wagon: async (p: Manager, a: { id: string }) => {
			return p.movableManager.getWagon(a.id);
		},
		wagonLinks: async (p: Manager, a: { session: string }) => {
			return Array.from(
				p
					.get(a.session)
					?.movableLinkManager.links.filter(
						(l) => l instanceof WagonLink
					)
					.values() ?? []
			);
		},
		wagonLink: async (p: Manager, a: { id: string; session: string }) => {
			return p.get(a.session)?.movableLinkManager.getWagonLink(a.id);
		},

		timetables: async (p: Manager, a: { session: string }) => {
			return Array.from(
				p.get(a.session)?.timetableManager.timetables.values() ?? []
			);
		},
		timetable: async (p: Manager, a: { session: string; id: string }) => {
			return p.get(a.session)?.timetableManager.get(a.id);
		},

		arrDepSets: async (p: Manager, a: { session: string }) =>
			Array.from(p.get(a.session)?.aDSManager.arrdepsets.values() ?? []),
		arrDepSet: async (p: Manager, a: { session: string; id: string }) =>
			p.get(a.session)?.aDSManager.get(a.id),

		users: async (p: Manager, a: { disabled?: boolean }) => {
			return Array.from(p.userManager.users.values()).filter(
				(u) => !u.disabled || a.disabled
			);
		},
		user: async (p: Manager, a: { id: string }) => {
			return p.userManager.get(a.id);
		},
		userLinks: async (p: Manager, a: { session: string }) => {
			return Array.from(
				p.get(a.session)?.userLinkManager.links.values() ?? []
			);
		},
		userLink: async (p: Manager, a: { session: string; id: string }) => {
			return p.get(a.session)?.userLinkManager.get(a.id);
		},

		sessions: async (p: Manager) => {
			return Array.from(p.sessions.values());
		},
		session: async (p: Manager, a: { id: string }) => {
			return p.get(a.id);
		},

		actions: async (_p: Manager, _a: { session: string }) => [],
		action: async (_p: Manager, _a: { session: string; id: string }) =>
			null,

		time: async (p: Manager, a: { session: string }) => {
			return p.get(a.session)?.timeManager;
		},
	},
	Mutation: {
		addStation: async (p: Manager, a: { input: any }, c: GQLContext) => {
			if (!c.user) throw Errors.unauth();
			return await p.stationManager.create(
				{
					...a.input,
					managerId: p.stationManager.id,
				},
				c.user
			);
		},
		modStation: async (
			p: Manager,
			a: { input: any; station: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();

			const station = p.stationManager.get(a.station, true);
			station.modify(a.input, c.user);
			return station;
		},
		setStationDispatcher: async (
			p: Manager,
			a: { session: string; station: string; dispatcher?: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();

			const session = p.get(a.session, true);

			const stationLink = session.stationLinkManager.get(a.station, true);
			const dispatcher = session.userLinkManager.get(
				a.dispatcher ?? "",
				Boolean(a.dispatcher)
			);

			stationLink.setDispatcher(
				dispatcher,
				User.checkLink(c.user, session)
			);
			return stationLink;
		},
		linkStation: async (
			p: Manager,
			a: { session: string; id: string; tracks?: string[] },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();

			const session = p.get(a.session, true);
			const ulink = User.checkLink(c.user, session);
			const station = p.stationManager.get(a.id, true);

			if (session.stationLinkManager.getByStation(station)) {
				throw new TMError(
					`EALREADYEXISTS`,
					`This StationLink already exists!`
				);
			}

			const tracks = a.tracks?.map((id) => station.getTrack(id, true));

			const stationLink = await session.stationLinkManager.create(
				{
					id: newUUID(),
					managerId: session.stationLinkManager.id,
					sessionId: session.id,
					stationId: station.id,
				},
				ulink
			);
			if (!tracks) return stationLink;
			for (const t of tracks) {
				stationLink.addTrackLink(
					{
						id: newUUID(),
						managerId: session.stationLinkManager.id,
						sessionId: session.id,
						stationLinkId: stationLink.id,
						trackId: t.id,
					},
					ulink
				);
			}

			return stationLink;
		},

		addStationTrack: async (
			p: Manager,
			a: { station: string; input: any },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();

			const station = p.stationManager.get(a.station, true);

			return await station.addTrack(
				{
					...a.input,
					managerId: p.stationManager.id,
					stationId: station.id,
				},
				c.user
			);
		},
		modStationTrack: async (
			p: Manager,
			a: {
				input: any;
				station: string;
				track: string;
			},
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();

			const station = p.stationManager.get(a.station, true);
			const track = station.getTrack(a.track, true);
			track.modify(a.input, c.user);
			return track;
		},
		linkStationTrack: async (
			p: Manager,
			a: {
				station: string;
				track: string;
				session: string;
			},
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const station = p.stationManager.get(a.station, true);
			const track = station.getTrack(a.track, true);

			const sl = session.stationLinkManager.getByStation(station);
			if (!sl)
				throw new TMError(
					`ENOLINK`,
					`The Station provided is not linked!`
				);
			if (sl.getTrackLink(track))
				throw new TMError(
					`EALREADYEXISTS`,
					`This TrackLink already exists!`
				);

			const tl = sl.addTrackLink(
				{
					id: newUUID(),
					managerId: session.stationLinkManager.id,
					sessionId: session.id,
					stationLinkId: sl.id,
					trackId: track.id,
				},
				User.checkLink(c.user, session)
			);
			return tl;
		},
		addTrain: async (
			p: Manager,
			a: { session: string; input: any },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);

			if (a.input.locomotiveLink) {
				a.input.locomotive = session.movableLinkManager.getLocoLink(
					a.input.locomotiveLink,
					true
				);
			}
			if (a.input.trainSets) {
				const sets = (a.input.trainSets as string[]).map((id: string) =>
					session.trainSetManager.get(id, true)
				);
				a.input.trainSets = sets;
			}
			if (a.input.location) {
				const station = session.stationLinkManager.get(
					a.input.location.stationLink,
					true
				);
				if (!a.input.location.trackLink) {
					a.input.location = { station };
				} else {
					const track = station.getTrackLink(
						a.input.location.trackLink,
						true
					);
					a.input.location = { station, track };
				}
			}

			return await session.trainManager.create(
				{
					...a.input,
					sessionId: session.id,
					managerId: session.trainManager.id,
				},
				User.checkLink(c.user, session)
			);
		},
		modTrain: async (
			p: Manager,
			a: { input: any; train: string; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const train = session.trainManager.get(a.train, true);

			await train.modify(a.input, User.checkLink(c.user, session));
			return train;
		},
		stateTrain: async (
			p: Manager,
			a: {
				input: any;
				train: string;
				state: TrainState;
				override?: boolean;
				session: string;
			},
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const train = session.trainManager.get(a.train, true);

			// TODO: add ...extra handling, ex. changing arrival track
			await train.updateTrainState(
				a.state,
				User.checkLink(c.user, session),
				a.override
			);
			return train;
		},
		addTrainSet: async (
			p: Manager,
			a: { session: string; input: any },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);

			if (a.input.components) {
				const movables = a.input.components.map((c: string) =>
					session.movableLinkManager.get(c, true)
				);
				a.input.components = movables;
			}

			return await session.trainSetManager.create(
				{
					...a.input,
					sessionId: session.id,
					managerId: session.trainSetManager.id,
				},
				User.checkLink(c.user, session)
			);
		},
		modTrainSet: async (
			p: Manager,
			a: { trainSet: string; input: any; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);

			const trainSet = session.trainSetManager.get(a.trainSet, true);

			await trainSet.modify(a.input, User.checkLink(c.user, session));
			return trainSet;
		},
		addLocomotive: async (p: Manager, a: { input: any }, c: GQLContext) => {
			if (!c.user) throw Errors.unauth();

			const owner = p.userManager.get(a.input.owner, true);

			return await p.movableManager.create(
				{
					...a.input,
					ownerId: owner.id,
					type: "LOCOMOTIVE",
					managerId: p.movableManager.id,
				},
				c.user
			);
		},
		modLocomotive: async (
			p: Manager,
			a: { input: any; locomotive: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const locomotive = p.movableManager.getLoco(a.locomotive, true);
			locomotive.modify(a.input, c.user);
			return locomotive;
		},
		linkLocomotive: async (
			p: Manager,
			a: { locomotive: string; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const locomotive = p.movableManager.getLoco(a.locomotive, true);
			if (session.movableLinkManager.getByLocomotive(locomotive))
				throw new TMError(
					`EALREADYEXISTS`,
					`This LocomotiveLink already exists!`
				);

			const locomotiveLink = session.movableLinkManager.create(
				{
					id: newUUID(),
					managerId: session.movableLinkManager.id,
					movableId: locomotive.id,
					type: "locomotivelink",
					sessionId: session.id,
				},
				User.checkLink(c.user, session)
			);
			return locomotiveLink;
		},
		addWagon: async (p: Manager, a: { input: any }, c: GQLContext) => {
			if (!c.user) throw Errors.unauth();

			const owner = p.userManager.get(a.input.owner, true);
			return await p.movableManager.create(
				{
					...a.input,
					type: "WAGON",
					managerId: p.movableManager.id,
					ownerId: owner.id,
				},
				c.user
			);
		},
		modWagon: async (
			p: Manager,
			a: { input: any; wagon: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();

			const wagon = p.movableManager.getWagon(a.wagon, true);
			wagon.modify(a.input, c.user);
			return wagon;
		},
		linkWagon: async (
			p: Manager,
			a: { wagon: string; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const wagon = p.movableManager.getWagon(a.wagon, true);
			if (session.movableLinkManager.getByWagon(wagon))
				throw new TMError(
					`EALREADYEXISTS`,
					`This WagonLink already exists!`
				);

			const wagonLink = session.movableLinkManager.create(
				{
					id: newUUID(),
					managerId: session.movableLinkManager.id,
					movableId: wagon.id,
					type: "wagonlink",
					sessionId: session.id,
				},
				User.checkLink(c.user, session)
			);
			return wagonLink;
		},
		addTimetable: async (
			p: Manager,
			a: { session: string; input: any },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);

			return await session.timetableManager.create(
				{
					...a.input,
					sessionId: session.id,
					managerId: session.timetableManager.id,
				},
				User.checkLink(c.user, session)
			);
		},
		modTimetable: async (
			p: Manager,
			a: { input: any; timetable: string; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const timetable = session.timetableManager.get(a.timetable, true);

			await timetable.modify(a.input, User.checkLink(c.user, session));
			return timetable;
		},
		activeTimetable: async (
			p: Manager,
			a: { timetable: string; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			User.checkPermission(c.user, "manage timetables", session);

			const timetable = session.timetableManager.get(a.timetable, true);
			return session.setActiveTimetable(timetable);
		},
		regenerateTimetableADS: async (
			p: Manager,
			a: { session: string; from?: Date },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			User.checkPermission(c.user, "manage timetables", session);

			const gen = await session.aDSManager.regenerateADS();
			return gen;
		},
		addTimetableEntry: async (
			p: Manager,
			a: { session: string; timetable: string; input: any },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const timetable = session.timetableManager.get(a.timetable, true);
			const train = session.trainManager.get(a.input.train, true);
			const stationLink = session.stationLinkManager.get(
				a.input.stationLink,
				true
			);
			const trackLink = stationLink.getTrackLink(a.input.trackLink, true);
			const locomotiveLink = session.movableLinkManager.get(
				a.input.locomotive,
				true
			);
			const sets = (a.input.sets as string[]).map((id) =>
				session.trainSetManager.get(id, true)
			);

			const entry = new TimetableEntry({
				managerId: session.timetableManager.id,
				sessionId: session.id,
				ttId: timetable.id,
				id: newUUID(),
				locomotiveLinkId: locomotiveLink.id,
				stationLinkId: stationLink.id,
				trackLinkId: trackLink.id,
				trainId: train.id,
				duration: a.input.duration,
				repeats: a.input.repeats,
				start: a.input.start,
				usedFrom: a.input.usedFrom,
				setIds: sets.map((s) => s.id),
				usedTill: a.input.usedTil,
			});
			timetable.addEntry(entry, User.checkLink(c.user, session));
			return entry;
		},
		addArrDepSet: async (
			p: Manager,
			a: { session: string; input: any },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const train = session.trainManager.get(a.input.trainId, true);
			const stationLink = session.stationLinkManager.get(
				a.input.stationLinkId,
				true
			);
			const trackLink = stationLink.getTrackLink(
				a.input.trackLinkId,
				true
			);
			const locomotiveLink = session.movableLinkManager.getLocoLink(
				a.input.locomotiveLinkId,
				true
			);
			const sets = (a.input.setIds as string[]).map((id) =>
				session.trainSetManager.get(id, true)
			);

			const ads = await session.aDSManager.create({
				scheduledArrival: a.input.scheduledArrival,
				scheduledDeparture: a.input.scheduledDeparture,
				arrivalDelay: a.input.arrivalDelay ?? 0,
				departureDelay: a.input.departureDelay ?? 0,
				actualArrival: a.input.actualArrival,
				actualDeparture: a.input.actualDeparture,
				id: newUUID(),
				locomotiveLinkId: locomotiveLink.id,
				managerId: session.aDSManager.id,
				sessionId: session.id,
				setIds: sets.map((s) => s.id),
				stationLinkId: stationLink.id,
				trackLinkId: trackLink.id,
				trainId: train.id,
				cancelledReason: a.input.cancelledReason,
			});
			return ads;
		},
		modArrDepSet: async (
			p: Manager,
			a: { session: string; arrdepset: string; input: any },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const ads = session.aDSManager.get(a.arrdepset, true);
			ads.modify(a.input, User.checkLink(c.user, session));
			return ads;
		},
		cancelArrDepSet: async (
			p: Manager,
			a: { session: string; arrdepset: string; reason: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const ads = session.aDSManager.get(a.arrdepset, true);
			ads.cancel(a.reason, User.checkLink(c.user, session));
			return ads;
		},
		delayArrDepSet: async (
			p: Manager,
			a: {
				session: string;
				arrdepset: string;
				delay: number;
				type: "ARRIVAL" | "DEPARTURE";
			},
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			const ads = session.aDSManager.get(a.arrdepset, true);
			ads.delay(a.delay, a.type, User.checkLink(c.user, session));
			return ads;
		},
		addUser: async (p: Manager, a: { input: any }, c: GQLContext) => {
			if (!c.user) throw Errors.unauth();

			if (a.input.admin && !c.user.admin)
				throw new TMError(
					`EFORBIDDEN`,
					`You are not authorized to grant Global Administrator permissions!`,
					{ permission: "globaladmin" }
				);

			const sessionPermissions = (
				a.input.permissions.session as
					| {
							session: string;
							permissions: number;
					  }[]
					| undefined
			)?.map((perm) => ({
				session: p.get(perm.session, true),
				permissions: perm.permissions,
			}));

			const passwordHash = a.input.password
				? User.hashPassword(a.input.password)
				: undefined;
			return await p.userManager.create(
				{
					...a.input,
					managerId: p.userManager.id,
					passwordHash,
					permissions: {
						global: a.input.permissons.global,
						session: sessionPermissions,
					},
				},
				c.user
			);
		},
		modUser: async (
			p: Manager,
			a: { input: any; user: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const user = p.userManager.get(a.user, true);
			await user.modify(a.input, c.user);
			return user;
		},
		addSession: async (p: Manager, a: { input: any }, c: GQLContext) => {
			if (!c.user) throw Errors.unauth();

			return await p.create({ ...a.input, ownerId: c.user.id }, c.user);
		},
		modSession: async (
			p: Manager,
			a: { input: any; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			await session.modify(a.input, c.user);
			return session;
		},

		modSessionTime: async (
			p: Manager,
			a: { input: any; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			session.timeManager.modify(a.input, c.user);
			return session.timeManager;
		},
		pauseSessionTime: async (
			p: Manager,
			a: { state: boolean; session: string },
			c: GQLContext
		) => {
			if (!c.user) throw Errors.unauth();
			const session = p.get(a.session, true);
			session.timeManager.setRunning(
				a.state,
				User.checkLink(c.user, session)
			);
			return session.timeManager;
		},
	},
};

export { GQLContext, resolvers };
