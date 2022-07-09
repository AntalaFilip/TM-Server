import { gql } from 'apollo-server-express';

const typeDefs = gql`
	scalar Date

	type Query {
		stations(realm: ID!): [Station]
		station(realm: ID!, id: ID!): Station

		trains(realm: ID!): [Train]
		train(realm: ID!, id: ID!): Train

		trainSets(realm: ID!): [TrainSet]
		trainSet(realm: ID!, id: ID!): TrainSet

		locomotives(realm: ID!): [Locomotive]
		locomotive(realm: ID!, id: ID!): Locomotive

		wagons(realm: ID!): [Wagon]
		wagon(realm: ID!, id: ID!): Wagon

		timetables(realm: ID!): [Timetable]
		timetable(realm: ID!, id: ID!): Timetable

		users: [User]!
		user(id: ID!): User

		realms: [Realm]!
		realm(id: ID!): Realm
	}

	type Mutation {
		addStation(realm: ID!, input: StationInput!): Station!
		addStationTrack(realm: ID!, station: ID!, input: StationTrackInput!): StationTrack!
		addTrain(realm: ID!, input: TrainInput!): Train!
		addTrainSet(realm: ID!, input: TrainSetInput!): TrainSet!
		addLocomotive(realm: ID!, input: LocomotiveInput!): Locomotive!
		addWagon(realm: ID!, input: WagonInput!): Wagon!
		addTimetable(realm: ID!, input: TimetableInput!): Timetable!
		addTimetableEntry(realm: ID!, timetable: ID!, input: TimetableEntryInput!): TimetableEntry!
		addUser(realm: ID!, input: UserInput!): User!
		addRealm(input: RealmInput!): Realm!
	}

	type Station {
		id: ID!
		realm: Realm!
		name: String!
		short: String!
		stationType: StationType!
		dispatcher: User
		tracks: [StationTrack]!
		trains: [Train]!
	}
	input StationInput {
		name: String!
		short: String!
		stationType: StationType!
		#tracks: [StationTrackInput!]
	}
	enum StationType {
		STATION
		STOP
	}

	type StationTrack {
		id: ID!
		realm: Realm!
		name: String!
		length: Int
		usedForParking: Boolean!
		station: Station
		currentTrain: Train
	}
	input StationTrackInput {
		name: String!
		usedForParking: Boolean!
		length: Int
	}

	type Train {
		id: ID!
		realm: Realm!
		name: String!
		short: String!
		state: TrainState!
		locomotive: Locomotive
		location: MovableLocation
		currentEntry: TimetableEntry
		nextEntry: TimetableEntry
		arrDepSet: ArrDepSet
		entries: [TimetableEntry]!
		trainSets: [TrainSet]!
	}
	input TrainInput {
		name: String!
		short: String!
		state: TrainState
		locomotive: ID
		trainSets: [ID!]
		location: MovableLocationInput
	}
	enum TrainState {
		MISSING
		MOVING
		ARRIVED
		READY
		LEAVING
	}
	type ArrDepSet {
		arrival: Date!
		departure: Date!
		no: Int!
	}

	type TrainSet {
		id: ID!
		name: String!
		components: [Movable]!
		trains: [Train]!
	}
	input TrainSetInput {
		name: String!
		components: [ID!]!
	}

	interface Movable {
		id: ID!
		realm: Realm!
		model: String!
		couplerType: String!
		name: String
		type: MovableType
		length: Int
		maxSpeed: Int
		currentLocation: MovableLocation
	}
	type MovableLocation {
		station: Station!
		track: StationTrack
	}
	input MovableLocationInput {
		station: ID!
		track: ID
	}
	enum MovableType {
		LOCOMOTIVE
		WAGON
	}

	type Locomotive implements Movable {
		id: ID!
		realm: Realm!
		model: String!
		couplerType: String!
		name: String
		type: MovableType
		length: Int
		maxSpeed: Int
		currentLocation: MovableLocation
		controller: User
	}
	input LocomotiveInput {
		model: String!
		couplerType: String!
		name: String
		length: Int
		maxSpeed: Int
		currentLocation: MovableLocationInput
		controller: ID
	}

	type Wagon implements Movable {
		id: ID!
		realm: Realm!
		model: String!
		couplerType: String!
		wagonType: WagonType!
		name: String
		type: MovableType
		length: Int
		maxSpeed: Int
		currentLocation: MovableLocation
	}
	input WagonInput {
		model: String!
		couplerType: String!
		wagonType: WagonType!
		name: String
		length: Int
		maxSpeed: Int
		currentLocation: MovableLocationInput
	}
	enum WagonType {
		PASSENGER
		CARGO
	}

	type Timetable {
		id: ID!
		realm: Realm!
		name: String!
		genCount: Int!
		checksPassing: Boolean!
		inUse: Boolean!
		entries: [TimetableEntry]!
	}
	input TimetableInput {
		name: String!
		genCount: Int!
	}

	type TimetableEntry {
		id: ID!
		realm: Realm!
		timetable: Timetable!
		train: Train!
		station: Station!
		locomotive: Locomotive!
		usedFrom: Date!
		usedTill: Date
		repeats: Int!
		start: Date!
		duration: Int!
		track: StationTrack!
		sets: [TrainSet]!
		times: [ArrDepSet]!
	}
	input TimetableEntryInput {
		train: ID!
		station: ID!
		track: ID!
		locomotive: ID!
		usedFrom: Date!
		usedTill: Date
		repeats: Int!
		start: Date!
		duration: Int!
		sets: [ID]!
	}

	type User {
		id: ID!
		name: String!
		username: String!
		disabled: Boolean!
		admin: Boolean!
		permissions: UserPermissions!
	}
	input UserInput {
		name: String!
		username: String!
		password: String!
		admin: Boolean
		permissions: UserPermissionsInput
	}

	type UserPermissions {
		global: Int!
		realm: [RealmUserPermissions]!
	}
	input UserPermissionsInput {
		global: Int!
		realm: [RealmUserPermissionsInput!]
	}
	type RealmUserPermissions {
		realm: Realm!
		permissions: Int!
	}
	input RealmUserPermissionsInput {
		realm: ID!
		permissions: Int!
	}

	type Realm {
		id: ID!
		name: String!
		owner: User!
		activeTimetable: Timetable
	}
	input RealmInput {
		name: String!
	}
`

export default typeDefs;