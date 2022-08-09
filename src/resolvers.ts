/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	AuthenticationError,
	ForbiddenError,
	UserInputError,
} from "apollo-server-core";
import DateScalar from "./graphql/dateScalar";
import Client from "./types/client";
import TimetableEntry, { ArrDepSet } from "./types/entry";
import Locomotive from "./types/locomotive";
import Movable from "./types/movable";
import Realm from "./types/realm";
import { TrainState } from "./types/train";
import TrainSet from "./types/trainset";
import User, { UserPermissions } from "./types/user";
import Wagon from "./types/wagon";
import LongScalar from "graphql-type-long";
import Station from "./types/station";
import { firstCapital } from "./helpers/string";

type GQLContext = {
	user?: User;
};

function createGQLResolvers(client: Client) {
	const resolvers = {
		Date: DateScalar,
		Long: LongScalar,
		Movable: {
			__resolveType: (obj: Movable) => firstCapital(obj.type),
		},
		TrainSet: {
			trains: (parent: TrainSet) =>
				parent.realm.trainManager.trains.filter((t) =>
					t.trainSets.includes(parent)
				),
		},
		TimetableEntry: {
			cancelledAds: (parent: TimetableEntry) =>
				parent.cancelledAds.map(
					(a) =>
						new ArrDepSet({
							no: a,
							entryId: parent.id,
							timetableId: parent.timetable.id,
							managerId: parent.manager.id,
						})
				),
			delayedAds: (parent: TimetableEntry) =>
				parent.delayedAds.map((d, no) => ({
					delay: d,
					ads: new ArrDepSet({
						no,
						entryId: parent.id,
						timetableId: parent.timetable.id,
						managerId: parent.manager.id,
					}),
				})),
		},
		Station: {
			tracks: (parent: Station) => Array.from(parent.tracks.values()),
		},
		Query: {
			stations: async (_p: never, a: { realm: string }) => {
				return Array.from(
					client.get(a.realm)?.stationManager.stations.values() ?? []
				);
			},
			station: async (_p: never, a: { realm: string; id: string }) => {
				return client.get(a.realm)?.stationManager.get(a.id);
			},
			trains: async (_p: never, a: { realm: string }) => {
				return Array.from(
					client.get(a.realm)?.trainManager.trains.values() ?? []
				);
			},
			train: async (_p: never, a: { realm: string; id: string }) => {
				return client.get(a.realm)?.trainManager.get(a.id);
			},
			trainSets: async (_p: never, a: { realm: string }) => {
				return Array.from(
					client.get(a.realm)?.trainSetManager.trainsets.values() ??
						[]
				);
			},
			trainSet: async (_p: never, a: { realm: string; id: string }) => {
				return client.get(a.realm)?.trainSetManager.get(a.id);
			},
			locomotives: async (_p: never, a: { realm: string }) => {
				return Array.from(
					client
						.get(a.realm)
						?.movableManager.movables.filter(
							(m) => m instanceof Locomotive
						)
						.values() ?? []
				);
			},
			locomotive: async (_p: never, a: { realm: string; id: string }) => {
				return client.get(a.realm)?.movableManager.getLoco(a.id);
			},
			wagons: async (_p: never, a: { realm: string }) => {
				return Array.from(
					client
						.get(a.realm)
						?.movableManager.movables.filter(
							(m) => m instanceof Wagon
						)
						.values() ?? []
				);
			},
			wagon: async (_p: never, a: { realm: string; id: string }) => {
				return client.get(a.realm)?.movableManager.getWagon(a.id);
			},
			timetables: async (_p: never, a: { realm: string }) => {
				return Array.from(
					client.get(a.realm)?.timetableManager.timetables.values()
				);
			},
			timetable: async (_p: never, a: { realm: string; id: string }) => {
				return client.get(a.realm)?.timetableManager.get(a.id);
			},
			users: async (_p: never, a: { disabled?: boolean }) => {
				return Array.from(client.userManager.users.values()).filter(
					(u) => !u.disabled || a.disabled
				);
			},
			user: async (_p: never, a: { id: string }) => {
				return client.userManager.get(a.id);
			},
			realms: async () => {
				return Array.from(client.realms.values());
			},
			realm: async (_p: never, a: { id: string }) => {
				return client.get(a.id);
			},
			time: async (_p: never, a: { realm: string }) => {
				return client.get(a.realm)?.timeManager;
			},
		},
		Mutation: {
			addStation: async (
				_p: never,
				a: { realm: string; input: any },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});
				return await realm.stationManager.create(
					{
						...a.input,
						realmId: realm.id,
						managerId: realm.stationManager.id,
					},
					c.user
				);
			},
			modStation: async (
				_p: never,
				a: { input: any; station: string; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const station = realm.stationManager.get(a.station);
				if (!station)
					throw new UserInputError(`Invalid Station ID!`, {
						tmCode: `EBADPARAM`,
						extension: `STATION`,
					});
				station.modify(a.input, c.user);
				return station;
			},
			setStationDispatcher: async (
				_p: never,
				a: { realm: string; station: string; dispatcher: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});

				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});
				const station = realm.stationManager.get(a.station);
				if (!station)
					throw new UserInputError(`Invalid Station ID!`, {
						code: `EBADPARAM`,
						extension: `STATION`,
					});
				const dispatcher = client.userManager.get(a.dispatcher);
				if (!dispatcher && a.dispatcher)
					throw new UserInputError(`Invalid User ID!`, {
						code: `EBADPARAM`,
						extension: `STATION`,
					});

				station.setDispatcher(dispatcher, c.user);
				return station;
			},
			addStationTrack: async (
				_p: never,
				a: { realm: string; station: string; input: any },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const station = realm.stationManager.get(a.station);
				if (!station)
					throw new UserInputError(`Invalid Station ID!`, {
						code: `EBADPARAM`,
						extension: `STATION`,
					});

				return await station.addTrack(
					{
						...a.input,
						realmId: realm.id,
						managerId: realm.stationManager.id,
						stationId: realm.stationManager.key(station.id),
					},
					c.user
				);
			},
			modStationTrack: async (
				_p: never,
				a: {
					input: any;
					station: string;
					track: string;
					realm: string;
				},
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const station = realm.stationManager.get(a.station);
				if (!station)
					throw new UserInputError(`Invalid Station ID!`, {
						tmCode: `EBADPARAM`,
						extension: `STATION`,
					});
				const track = station.tracks.get(a.track);
				if (!track)
					throw new UserInputError(`Invalid Track ID!`, {
						tmCode: `EBADPARAM`,
						extension: `TRACK`,
					});

				track.modify(a.input, c.user);
				return track;
			},
			addTrain: async (
				_p: never,
				a: { realm: string; input: any },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				if (a.input.locomotive) {
					const loco = realm.movableManager.getLoco(
						a.input.locomotive
					);
					if (!loco)
						throw new UserInputError(`Invalid Locomotive ID!`, {
							code: `EBADPARAM`,
							extension: `LOCOMOTIVE`,
						});
					a.input.locomotive = loco;
				}
				if (a.input.trainSets) {
					const sets = a.input.trainSets
						.map((id: string) => realm.trainSetManager.get(id))
						.filter((t: TrainSet) => t != null);
					if (sets.length != a.input.trainSets.length)
						throw new UserInputError(`Invalid TrainSet IDs!`, {
							code: `EBADPARAM`,
							extension: `TRAINSET`,
						});
					a.input.trainSets = sets;
				}
				if (a.input.location) {
					const station = realm.stationManager.get(
						a.input.location.station
					);
					if (!station)
						throw new UserInputError(`Invalid Station ID!`, {
							code: `EBADPARAM`,
							extension: `STATION`,
						});
					const track = station.tracks.get(a.input.location.track);
					if (!track && a.input.location.track)
						throw new UserInputError(`Invalid Track ID!`, {
							code: `EBADPARAM`,
							extension: `TRACK`,
						});

					a.input.location = { station, track };
				}

				return await realm.trainManager.create(
					{
						...a.input,
						realmId: realm.id,
						managerId: realm.trainManager.id,
					},
					c.user
				);
			},
			modTrain: async (
				_p: never,
				a: { input: any; train: string; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const train = realm.trainManager.get(a.train);
				if (!train)
					throw new UserInputError(`Invalid Train ID!`, {
						tmCode: `EBADPARAM`,
						extension: `TRAIN`,
					});

				await train.modify(a.input, c.user);
				return train;
			},
			stateTrain: async (
				_p: never,
				a: {
					input: any;
					train: string;
					state: TrainState;
					override?: boolean;
					realm: string;
				},
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const train = realm.trainManager.get(a.train);
				if (!train)
					throw new UserInputError(`Invalid Train ID!`, {
						tmCode: `EBADPARAM`,
						extension: `TRAIN`,
					});

				// TODO: add ...extra handling, ex. changing arrival track
				train.updateTrainState(a.state, c.user, a.override);
				return train;
			},
			addTrainSet: async (
				_p: never,
				a: { realm: string; input: any },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				if (a.input.components) {
					const movables = a.input.components
						.map((c: string) => realm.movableManager.get(c))
						.filter((m: Movable) => m != null);
					if (movables.length != a.input.components.length)
						throw new UserInputError(`Invalid Movable IDs!`, {
							code: `EBADPARAM`,
							extentsion: `COMPONENTS`,
						});

					a.input.components = movables;
				}

				return await realm.trainSetManager.create(
					{
						...a.input,
						realmId: realm.id,
						managerId: realm.trainSetManager.id,
					},
					c.user
				);
			},
			modTrainSet: async (
				_p: never,
				a: { trainSet: string; input: any; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const trainSet = realm.trainSetManager.get(a.trainSet);
				if (!trainSet)
					throw new UserInputError(`Invalid Train Set ID!`, {
						tmCode: `EBADPARAM`,
						extension: `TRAINSET`,
					});

				await trainSet.modify(a.input, c.user);
				return trainSet;
			},
			addLocomotive: async (
				_p: never,
				a: { realm: string; input: any },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				if (a.input.location) {
					const station = realm.stationManager.get(
						a.input.location.station
					);
					if (!station)
						throw new UserInputError(`Invalid Station ID!`, {
							code: `EBADPARAM`,
							extension: `STATION`,
						});
					const track = station.tracks.get(a.input.location.track);
					if (!track && a.input.location.track)
						throw new UserInputError(`Invalid Track ID!`, {
							code: `EBADPARAM`,
							extension: `TRACK`,
						});

					a.input.location = { station, track };
				}
				if (a.input.controller) {
					const controller = realm.client.userManager.get(
						a.input.controller
					);
					if (!controller)
						throw new UserInputError(`Invalid User ID!`, {
							code: `EBADPARAM`,
							extension: `CONTROLLER`,
						});

					a.input.controller = controller;
				}

				return await realm.movableManager.create(
					{
						...a.input,
						type: "locomotive",
						realmId: realm.id,
						managerId: realm.movableManager.id,
					},
					c.user
				);
			},
			modLocomotive: async (
				_p: never,
				a: { input: any; locomotive: string; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const locomotive = realm.movableManager.getLoco(a.locomotive);
				if (!locomotive)
					throw new UserInputError(`Invalid Locomotive ID!`, {
						tmCode: `EBADPARAM`,
						extension: `LOCOMOTIVE`,
					});

				locomotive.modify(a.input, c.user);
				return locomotive;
			},
			addWagon: async (
				_p: never,
				a: { realm: string; input: any },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				if (a.input.location) {
					const station = realm.stationManager.get(
						a.input.location.station
					);
					if (!station)
						throw new UserInputError(`Invalid Station ID!`, {
							code: `EBADPARAM`,
							extension: `STATION`,
						});
					const track = station.tracks.get(a.input.location.track);
					if (!track && a.input.location.track)
						throw new UserInputError(`Invalid Track ID!`, {
							code: `EBADPARAM`,
							extension: `TRACK`,
						});

					a.input.location = { station, track };
				}

				return await realm.movableManager.create(
					{
						...a.input,
						type: "wagon",
						realmId: realm.id,
						managerId: realm.movableManager.id,
					},
					c.user
				);
			},
			modWagon: async (
				_p: never,
				a: { input: any; wagon: string; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const wagon = realm.movableManager.getWagon(a.wagon);
				if (!wagon)
					throw new UserInputError(`Invalid Wagon ID!`, {
						tmCode: `EBADPARAM`,
						extension: `WAGON`,
					});

				wagon.modify(a.input, c.user);
				return wagon;
			},
			addTimetable: async (
				_p: never,
				a: { realm: string; input: any },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				return await realm.timetableManager.create(
					{
						...a.input,
						realmId: realm.id,
						managerId: realm.timetableManager.id,
					},
					c.user
				);
			},
			modTimetable: async (
				_p: never,
				a: { input: any; timetable: string; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const timetable = realm.timetableManager.get(a.timetable);
				if (!timetable)
					throw new UserInputError(`Invalid Timetable ID!`, {
						tmCode: `EBADPARAM`,
						extension: `TIMETABLE`,
					});

				await timetable.modify(a.input, c.user);
				return timetable;
			},
			activeTimetable: async (
				_p: never,
				a: { timetable: string; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				if (!c.user.hasPermission(`manage timetables`, realm))
					throw new ForbiddenError(`No permission!`, {
						tmCode: `ENOPERM`,
						permission: `manage timetables`,
					});
				const timetable = realm.timetableManager.get(a.timetable);
				if (!timetable)
					throw new UserInputError(`Invalid Timetable ID!`, {
						tmCode: `EBADPARAM`,
						extension: `TIMETABLE`,
					});

				return realm.setActiveTimetable(timetable);
			},
			addTimetableEntry: async (
				_p: never,
				a: { realm: string; timetable: string; input: any },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				const timetable = realm.timetableManager.get(a.timetable);
				if (!timetable)
					throw new UserInputError(`Invalid Timetable ID!`, {
						error: `EBADPARAM`,
						extension: `TIMETABLE`,
					});

				const train = realm.trainManager.get(a.input.train);
				if (!train)
					throw new UserInputError(`Invalid Train ID!`, {
						error: `EBADPARAM`,
						extension: `TRAIN`,
					});
				const station = realm.stationManager.get(a.input.station);
				if (!station)
					throw new UserInputError(`Invalid Station ID!`, {
						error: `EBADPARAM`,
						extension: `STATION`,
					});
				const track = station.tracks.get(a.input.track);
				if (!track)
					throw new UserInputError(`Invalid Track ID!`, {
						error: `EBADPARAM`,
						extension: `TRACK`,
					});
				const locomotive = realm.stationManager.get(a.input.locomotive);
				if (!locomotive)
					throw new UserInputError(`Invalid Locomotive ID!`, {
						error: `EBADPARAM`,
						extension: `LOCOMOTIVE`,
					});

				const sets = a.input.sets.map((id: string) =>
					realm.trainSetManager.get(id)
				);
				if (sets.length != a.input.sets.length)
					throw new UserInputError(`Invalid Set IDs!`, {
						error: `EBADPARAM`,
						extension: `SETS`,
					});

				const entry = new TimetableEntry({
					...a.input,
					managerId: realm.timetableManager.id,
					realmId: realm.id,
				});
				timetable.addEntry(entry, c.user);
				return entry;
			},
			addUser: async (_p: never, a: { input: any }, c: GQLContext) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});

				if (a.input.admin && !c.user.admin)
					throw new ForbiddenError(
						`You are not authorized to grant Global Administrator permissions!`,
						{ code: `ENOPERM`, extension: `GRANT: global admin` }
					);

				if (a.input.permissions?.realm) {
					const realmPermissions = a.input.permissions.realm.map(
						(perm: { realm: string; permissions: number }) => ({
							realm: client.get(perm.realm),
							permissions: perm.permissions,
						})
					);
					if (
						!realmPermissions.every(
							(perm: UserPermissions) =>
								perm.realm instanceof Realm
						)
					)
						throw new UserInputError(
							`Invalid UserPermissions Realm IDs`,
							{
								code: `EBADPARAM`,
								extension: `USERPERMISSIONS REALM`,
							}
						);

					a.input.permissions.realm = realmPermissions;
				}

				const passwordHash = a.input.password
					? User.hashPassword(a.input.password)
					: undefined;
				return await client.userManager.create(
					{
						...a.input,
						managerId: client.userManager.id,
						passwordHash,
					},
					c.user
				);
			},
			modUser: async (
				_p: never,
				a: { input: any; user: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});

				const user = client.userManager.get(a.user);
				if (!user)
					throw new UserInputError(`Invalid User ID!`, {
						tmCode: `EBADPARAM`,
						extension: `USER`,
					});

				await user.modify(a.input, c.user);
				return user;
			},
			addRealm: async (_p: never, a: { input: any }, c: GQLContext) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});

				return await client.create(
					{ ...a.input, ownerId: c.user.id },
					c.user
				);
			},
			modRealm: async (
				_p: never,
				a: { input: any; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				await realm.modify(a.input, c.user);
				return realm;
			},

			modRealmTime: async (
				_p: never,
				a: { input: any; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				realm.timeManager.modify(a.input, c.user);
				return realm.timeManager;
			},
			pauseRealmTime: async (
				_p: never,
				a: { state: boolean; realm: string },
				c: GQLContext
			) => {
				if (!c.user)
					throw new AuthenticationError(`Unauthenticated`, {
						tmCode: `ENOAUTH`,
					});
				const realm = client.get(a.realm);
				if (!realm)
					throw new UserInputError(`Invalid Realm ID!`, {
						tmCode: `EBADPARAM`,
						extension: `REALM`,
					});

				realm.timeManager.setRunning(a.state, c.user);
				return realm.timeManager;
			},
		},
	};
	return resolvers;
}

export default createGQLResolvers;
export { GQLContext };
