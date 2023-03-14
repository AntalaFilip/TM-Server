import { gql } from "apollo-server-express";

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

		sessions(realm: ID!): [Session]!
		session(realm: ID!, id: ID!): Session

		arrDepSets(realm: ID!, session: ID!): [ArrDepSet]!
		arrDepSet(realm: ID!, session: ID!, id: ID!): ArrDepSet

		users(disabled: Boolean): [User]!
		user(id: ID!): User

		realms: [Realm]!
		realm(id: ID!): Realm

		time(realm: ID!, session: ID!): Time
	}

	type Mutation {
		addStation(realm: ID!, input: StationInput!): Station!
		modStation(realm: ID!, station: ID!, input: StationInput!): Station!
		setStationDispatcher(realm: ID!, station: ID!, session: ID!, dispatcher: ID): Station!

		addStationTrack(
			realm: ID!
			station: ID!
			input: StationTrackInput!
		): StationTrack!
		modStationTrack(
			realm: ID!
			station: ID!
			track: ID!
			input: StationTrackInput!
		): StationTrack!

		addTrain(realm: ID!, input: TrainInput!): Train!
		modTrain(realm: ID!, train: ID!, input: TrainInput!): Train!
		stateTrain(
			realm: ID!
			session: ID!
			train: ID!
			state: TrainState!
			override: Boolean
		): Train!

		addTrainSet(realm: ID!, input: TrainSetInput!): TrainSet!
		modTrainSet(realm: ID!, trainSet: ID!, input: TrainSetInput!): TrainSet!

		addLocomotive(realm: ID!, input: LocomotiveInput!): Locomotive!
		modLocomotive(
			realm: ID!
			locomotive: ID!
			input: LocomotiveInput!
		): Locomotive!

		addWagon(realm: ID!, input: WagonInput!): Wagon!
		modWagon(realm: ID!, wagon: ID!, input: WagonInput!): Wagon!

		addTimetable(realm: ID!, input: TimetableInput!): Timetable!
		modTimetable(
			realm: ID!
			timetable: ID!
			input: TimetableInput!
		): Timetable!
		#activeTimetable(realm: ID!, timetable: ID!): Boolean!

		addTimetableEntry(
			realm: ID!
			timetable: ID!
			input: TimetableEntryInput!
		): TimetableEntry!
		modTimetableEntry(
			realm: ID!
			timetable: ID!
			entry: ID!
			input: TimetableEntryInput!
		): TimetableEntry!

		addUser(input: UserInput!): User!
		modUser(user: ID!, input: UserModInput!): User!

		addRealm(input: RealmInput!): Realm!
		modRealm(realm: ID!, input: RealmInput!): Realm!

		modTime(realm: ID!, session: ID!, input: TimeInput!): Time!
		pauseTime(realm: ID!, session: ID!, state: Boolean!): Time!
	}

	type Station {
		id: ID!
		realm: Realm!
		name: String!
		short: String!
		stationType: StationType!
		tracks: [StationTrack]!
		sessionData: [StationSessionData]!
	}
	type StationSessionData {
		id: ID!
		session: Session!
		dispatcher: User
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
		short: String!
		usedForParking: Boolean!
		length: Int
		station: Station!
		sessionData: [StationTrackSessionData]!
	}
	type StationTrackSessionData {
		id: ID!
		session: Session!
		currentTrain: Train
	}
	input StationTrackInput {
		name: String!
		short: String!
		usedForParking: Boolean!
		length: Int
	}

	type Train {
		id: ID!
		realm: Realm!
		name: String!
		short: String!
		sessionData: [TrainSessionData]!
	}
	type TrainSessionData {
		id: ID!
		session: Session!
		state: TrainState!
		locomotive: Locomotive
		location: MovableLocation
		currentADS: ArrDepSet
		nextADS: ArrDepSet
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
		id: ID!
		session: Session!
		entry: TimetableEntry

		scheduledArrival: Date!
		actualArrival: Date
		scheduledDeparture: Date!
		actualDeparture: Date
		cancelled: Boolean!

		train: Train!
		station: Station!
		track: StationTrack!
		locomotive: Locomotive!
		sets: [TrainSet]!
	}

	type TrainSet {
		id: ID!
		realm: Realm!
		name: String!
		components: [Movable]!
		trains: [Train]!
	}
	input TrainSetInput {
		name: String!
		components: [ID!]!
	}

	type Session {
		id: ID!
		realm: Realm!
		started: Date!
		ended: Date
		active: Boolean!
		time: Time!
		arrDepSets: [ArrDepSet]!
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
		owner: User
		sessionData: [MovableSessionData]!
	}
	interface MovableSessionData {
		id: ID!
		session: Session!
		currentLocation: MovableLocation
		currentTrain: Train
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
		owner: User
		sessionData: [LocomotiveSessionData]!
	}
	type LocomotiveSessionData implements MovableSessionData {
		id: ID!
		session: Session!
		currentLocation: MovableLocation
		currentTrain: Train
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
		owner: ID
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
		owner: User
		sessionData: [WagonSessionData]!
	}
	type WagonSessionData implements MovableSessionData {
		id: ID!
		session: Session!
		currentLocation: MovableLocation
		currentTrain: Train
	}
	input WagonInput {
		model: String!
		couplerType: String!
		wagonType: WagonType!
		name: String
		length: Int
		maxSpeed: Int
		currentLocation: MovableLocationInput
		owner: ID
	}
	enum WagonType {
		PASSENGER
		CARGO
	}

	type Timetable {
		id: ID!
		realm: Realm!
		name: String!
		checksPassing: Boolean!
		#inUse: Boolean!
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
		email: String
		emailMD5: String!
		disabled: Boolean!
		admin: Boolean!
		permissions: UserPermissions!
		controlling: [Locomotive]!
		owning: [Realm]!
		dispatching: Station
	}
	input UserInput {
		name: String!
		username: String!
		email: String!
		password: String
		admin: Boolean
		permissions: UserPermissionsInput
	}
	input UserModInput {
		name: String
		username: String
		password: String
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

	type Time {
		startPoint: Float!
		speedModifier: Int!
		trueElapsed: Float!
		elapsed: Float!
		running: Boolean!
		restricted: Boolean!
	}
	input TimeInput {
		startPoint: Float
		speedModifier: Int
		running: Boolean
		restricted: Boolean
	}
`;

export default typeDefs;
