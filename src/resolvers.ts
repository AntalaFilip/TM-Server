/* eslint-disable @typescript-eslint/no-explicit-any */
import { AuthenticationError, ForbiddenError, UserInputError } from "apollo-server-core";
import DateScalar from "./graphql/dateScalar";
import Client from "./types/client";
import TimetableEntry from "./types/entry";
import Locomotive from "./types/locomotive";
import Movable from "./types/movable";
import Realm from "./types/realm";
import TrainSet from "./types/trainset";
import User, { UserPermissions } from "./types/user";
import Wagon from "./types/wagon";

function createGQLResolvers(client: Client) {
	const resolvers = {
		Date: DateScalar,
		Query: {
			stations: async (_p: never, a: { realm: string; }) => {
				const realm = client.get(a.realm);
				return realm?.stationManager.getAll();
			},
			station: async (_p: never, a: { realm: string; id: string; }) => {
				const realm = client.get(a.realm);
				return realm?.stationManager.getOne(a.id);
			},
			trains: async (_p: never, a: { realm: string; }) => {
				const realm = client.get(a.realm);
				return realm?.trainManager.getAll();
			},
			train: async (_p: never, a: { realm: string; id: string; }) => {
				return client.get(a.realm)?.trainManager.getOne(a.id);
			},
			trainSets: async (_p: never, a: { realm: string; }) => {
				return client.get(a.realm)?.trainSetManager.getAll();
			},
			trainSet: async (_p: never, a: { realm: string; id: string; }) => {
				return client.get(a.realm)?.trainSetManager.getOne(a.id);
			},
			locomotives: async (_p: never, a: { realm: string; }) => {
				return client.get(a.realm)?.movableManager.movables.filter(m => m instanceof Locomotive).map(l => l.fullMetadata());
			},
			locomotive: async (_p: never, a: { realm: string; id: string; }) => {
				return client.get(a.realm)?.movableManager.getLoco(a.id)?.fullMetadata();
			},
			wagons: async (_p: never, a: { realm: string; }) => {
				return client.get(a.realm)?.movableManager.movables.filter(m => m instanceof Wagon).map(w => w.fullMetadata());
			},
			wagon: async (_p: never, a: { realm: string; id: string; }) => {
				return client.get(a.realm)?.movableManager.getWagon(a.id)?.fullMetadata();
			},
			timetables: async (_p: never, a: { realm: string; }) => {
				return client.get(a.realm)?.timetableManager.getAll();
			},
			timetable: async (_p: never, a: { realm: string; id: string; }) => {
				return client.get(a.realm)?.timetableManager.getOne(a.id);
			},
			users: async () => {
				return client.userManager.getAll();
			},
			user: async (_p: never, a: { id: string; }) => {
				return client.userManager.getOne(a.id);
			},
			realms: async () => {
				return client.getAll();
			},
			realm: async (_p: never, a: { id: string; }) => {
				return client.getOne(a.id);
			}
		},
		Mutation: {
			addStation: async (_p: never, a: { realm: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage stations', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage stations` });

				const station = await realm.stationManager.create({ ...a.input, realmId: realm.id, managerId: realm.stationManager.id }, c.user);
				return station.fullMetadata();
			},
			addStationTrack: async (_p: never, a: { realm: string; station: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage stations', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage stations` });

				const station = realm.stationManager.get(a.station);
				if (!station) throw new UserInputError(`Invalid Station ID!`, { code: `EBADPARAM`, extension: `STATION` });

				const track = await station.addTrack({ ...a.input, realmId: realm.id, managerId: realm.stationManager.id }, c.user);
				return track.fullMetadata();
			},
			addTrain: async (_p: never, a: { realm: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage trains', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage trains` });

				if (a.input.locomotive) {
					const loco = realm.movableManager.getLoco(a.input.locomotive);
					if (!loco) throw new UserInputError(`Invalid Locomotive ID!`, { code: `EBADPARAM`, extension: `LOCOMOTIVE` });
					a.input.locomotive = loco;
				}
				if (a.input.trainSets) {
					const sets = a.input.trainSets.map((id: string) => realm.trainSetManager.get(id)).filter((t: TrainSet) => t != null);
					if (sets.length != a.input.trainSets.length) throw new UserInputError(`Invalid TrainSet IDs!`, { code: `EBADPARAM`, extension: `TRAINSET` });
					a.input.trainSets = sets;
				}
				if (a.input.location) {
					const station = realm.stationManager.get(a.input.location.station);
					if (!station) throw new UserInputError(`Invalid Station ID!`, { code: `EBADPARAM`, extension: `STATION` });
					const track = station.tracks.get(a.input.location.track);
					if (!track && a.input.location.track) throw new UserInputError(`Invalid Track ID!`, { code: `EBADPARAM`, extension: `TRACK` });

					a.input.location = { station, track };
				}

				const train = await realm.trainManager.create({ ...a.input, realmId: realm.id, managerId: realm.trainManager.id }, c.user);
				return train.fullMetadata();
			},
			addTrainSet: async (_p: never, a: { realm: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage trains', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage trains` });

				if (a.input.components) {
					const movables = a.input.components.map((c: string) => realm.movableManager.get(c)).filter((m: Movable) => m != null);
					if (movables.length != a.input.components.length) throw new UserInputError(`Invalid Movable IDs!`, { code: `EBADPARAM`, extentsion: `COMPONENTS` });

					a.input.components = movables;
				}

				const set = await realm.trainSetManager.create({ ...a.input, realmId: realm.id, managerId: realm.trainSetManager.id }, c.user);
				return set.fullMetadata()
			},
			addLocomotive: async (_p: never, a: { realm: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage movables', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage movables` });

				if (a.input.location) {
					const station = realm.stationManager.get(a.input.location.station);
					if (!station) throw new UserInputError(`Invalid Station ID!`, { code: `EBADPARAM`, extension: `STATION` });
					const track = station.tracks.get(a.input.location.track);
					if (!track && a.input.location.track) throw new UserInputError(`Invalid Track ID!`, { code: `EBADPARAM`, extension: `TRACK` });

					a.input.location = { station, track };
				}
				if (a.input.controller) {
					const controller = realm.client.userManager.get(a.input.controller);
					if (!controller) throw new UserInputError(`Invalid User ID!`, { code: `EBADPARAM`, extension: `CONTROLLER` });

					a.input.controller = controller;
				}

				const loco = await realm.movableManager.create({ ...a.input, type: 'locomotive', realmId: realm.id, managerId: realm.movableManager.id }, c.user);
				return loco.fullMetadata();
			},
			addWagon: async (_p: never, a: { realm: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage movables', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage movables` });

				if (a.input.location) {
					const station = realm.stationManager.get(a.input.location.station);
					if (!station) throw new UserInputError(`Invalid Station ID!`, { code: `EBADPARAM`, extension: `STATION` });
					const track = station.tracks.get(a.input.location.track);
					if (!track && a.input.location.track) throw new UserInputError(`Invalid Track ID!`, { code: `EBADPARAM`, extension: `TRACK` });

					a.input.location = { station, track };
				}

				const wagon = await realm.movableManager.create({ ...a.input, type: 'wagon', realmId: realm.id, managerId: realm.movableManager.id });
				return wagon.fullMetadata();
			},
			addTimetable: async (_p: never, a: { realm: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage timetables', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage timetables` });

				const timetable = await realm.timetableManager.create({ ...a.input, realmId: realm.id, managerId: realm.timetableManager.id });
				return timetable.fullMetadata();
			},
			addTimetableEntry: async (_p: never, a: { realm: string; timetable: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage timetables', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage timetables` });
				const timetable = realm.timetableManager.get(a.timetable);
				if (!timetable) throw new UserInputError(`Invalid Timetable ID!`, { error: `EBADPARAM`, extension: `TIMETABLE` });

				const train = realm.trainManager.get(a.input.train);
				if (!train) throw new UserInputError(`Invalid Train ID!`, { error: `EBADPARAM`, extension: `TRAIN` });
				const station = realm.stationManager.get(a.input.station);
				if (!station) throw new UserInputError(`Invalid Station ID!`, { error: `EBADPARAM`, extension: `STATION` });
				const track = station.tracks.get(a.input.track);
				if (!track) throw new UserInputError(`Invalid Track ID!`, { error: `EBADPARAM`, extension: `TRACK` });
				const locomotive = realm.stationManager.get(a.input.locomotive);
				if (!locomotive) throw new UserInputError(`Invalid Locomotive ID!`, { error: `EBADPARAM`, extension: `LOCOMOTIVE` });

				const sets = a.input.sets.map((id: string) => realm.trainSetManager.get(id));
				if (sets.length != a.input.sets.length) throw new UserInputError(`Invalid Set IDs!`, { error: `EBADPARAM`, extension: `SETS` });

				const entry = new TimetableEntry({ ...a.input, managerId: realm.timetableManager.id, realmId: realm.id });
				timetable.addEntry(entry);
				return entry.fullMetadata();
			},
			addUser: async (_p: never, a: { realm: string; input: any; }, c: { user?: User }) => {
				const realm = client.get(a.realm);
				if (!realm) throw new UserInputError(`Invalid Realm ID!`, { code: `EBADPARAM`, extension: `REALM` });
				if (!c.user || !c.user.hasPermission('manage users', realm)) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage users` });

				if (a.input.admin && !c.user.admin) throw new ForbiddenError(`You are not authorized to grant Global Administrator permissions!`, { code: `ENOPERM`, extension: `grant global admin` });

				if (a.input.permissions?.realm) {
					const realmPermissions = a.input.permissions.realm.map((perm: { realm: string, permissions: number }) => ({ realm: client.get(perm.realm), permissions: perm.permissions }));
					if (!realmPermissions.every((perm: UserPermissions) => perm.realm instanceof Realm)) throw new UserInputError(`Invalid UserPermissions Realm IDs`, { code: `EBADPARAM`, extension: `USERPERMISSIONS REALM` });

					a.input.permissions.realm = realmPermissions;
				}

				const user = await client.userManager.create({ ...a.input, managerId: client.userManager.id, realmId: realm.id });
				return user.fullMetadata();
			},
			addRealm: async (_p: never, a: { input: any; }, c: { user?: User }) => {
				if (!c.user || !c.user.hasPermission('manage realm')) throw new AuthenticationError(`No permission`, { code: `ENOPERM`, extension: `manage realm` });

				const realm = await client.create({ ...a.input, ownerId: c.user.id });
				return realm.fullMetadata();
			}
		}
	};
	return resolvers;
}

export default createGQLResolvers;