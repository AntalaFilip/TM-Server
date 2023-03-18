const typeDefs = `#graphql
	scalar Date

	type Query {
		stations: [Station]
		station(id: ID!): Station
		stationLink(id: ID!, session: ID!): StationLink

		trains(session: ID!): [Train]
		train(session: ID!, id: ID!): Train

		trainSets(session: ID!): [TrainSet]
		trainSet(session: ID!, id: ID!): TrainSet

		locomotives: [Locomotive]
		locomotive(id: ID!): Locomotive
		locomotiveLink(id: ID!, session: ID!): LocomotiveLink

		wagons: [Wagon]
		wagon(id: ID!): Wagon
		wagonLink(id: ID!, session: ID!): WagonLink

		timetables(session: ID!): [Timetable]
		timetable(session: ID!, id: ID!): Timetable

		arrDepSets(session: ID!): [ArrDepSet]
		arrDepSet(session: ID!, id: ID!): ArrDepSet

		users(disabled: Boolean): [User]!
		user(id: ID!): User

		sessions: [Session]!
		session(id: ID!): Session

		actions(session: ID!): [Action]!
		action(session: ID!, id: ID!): Action

		time(session: ID!): SessionTime
	}

	type Mutation {
		addStation(input: StationInput!): Station!
		modStation(station: ID!, input: StationInput!): Station!
		setStationDispatcher(session: ID!, station: ID!, dispatcher: ID): Station!
		linkStation(station: ID!, session: ID!, tracks: [ID!]): StationLink!

		addStationTrack(
			station: ID!
			input: StationTrackInput!
		): StationTrack!
		modStationTrack(
			station: ID!
			track: ID!
			input: StationTrackInput!
		): StationTrack!
		linkStationTrack(station: ID!, track: ID!, session: ID!): StationTrackLink!

		addTrain(session: ID!, input: TrainInput!): Train!
		modTrain(session: ID!, train: ID!, input: TrainInput!): Train!
		stateTrain(
			session: ID!
			train: ID!
			state: TrainState!
			override: Boolean
		): Train!
		#foundTrain(session: ID!, train: ID!, input: TrainFoundInput!): Train!

		addTrainSet(session: ID!, input: TrainSetInput!): TrainSet!
		modTrainSet(session: ID!, trainSet: ID!, input: TrainSetInput!): TrainSet!

		addLocomotive(input: LocomotiveInput!): Locomotive!
		modLocomotive(
			locomotive: ID!
			input: LocomotiveInput!
		): Locomotive!
		linkLocomotive(locomotive: ID!, session: ID!): LocomotiveLink!

		addWagon(input: WagonInput!): Wagon!
		modWagon(wagon: ID!, input: WagonInput!): Wagon!
		linkWagon(wagon: ID!, session: ID!): WagonLink!

		addTimetable(session: ID!, input: TimetableInput!): Timetable!
		modTimetable(
			session: ID!
			timetable: ID!
			input: TimetableInput!
		): Timetable!
		activeTimetable(session: ID!, timetable: ID!): Boolean!
		regenerateTimetableADS(session: ID!, timetable: ID!, from: Date): [ArrDepSet]!

		addTimetableEntry(
			session: ID!
			timetable: ID!
			input: TimetableEntryInput!
		): TimetableEntry!
		modTimetableEntry(
			session: ID!
			timetable: ID!
			entry: ID!
			input: TimetableEntryInput!
		): TimetableEntry!

		addArrDepSet(session: ID!, input: ArrDepSetInput!): ArrDepSet!
		modArrDepSet(session: ID!, arrdepset: ID!, input: ArrDepSetInput!): ArrDepSet!
		cancelArrDepSet(session: ID!, arrdepset: ID!, reason: String!): ArrDepSet!
		delayArrDepSet(session: ID!, arrdepset: ID!, delay: Int!, type: ADSDelayType!): ArrDepSet!

		addUser(input: UserInput!): User!
		modUser(user: ID!, input: UserModInput!): User!
		linkUser(user: ID!, session: ID!): UserLink!

		addSession(input: SessionInput!): Session!
		modSession(session: ID!, input: SessionInput!): Session!

		modSessionTime(session: ID!, input: SessionTimeInput!): SessionTime!
		pauseSessionTime(session: ID!, state: Boolean!): SessionTime!
	}

	type Station {
		id: ID!
		name: String!
		short: String!
		stationType: StationType!
		tracks: [StationTrack]!
	}
	type StationLink {
		id: ID!
		session: Session!
		station: Station!
		dispatcher: User
		trains: [Train]!
		trackLinks: [StationTrackLink]!
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
		name: String!
		short: String!
		usedForParking: Boolean!
		length: Int
		station: Station!
	}
	type StationTrackLink {
		id: ID!
		session: Session!
		track: StationTrack!
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
		session: Session!
		name: String!
		short: String!
		state: TrainState!
		locomotiveLink: LocomotiveLink
		location: MovableLocation
		currentEntry: TimetableEntry
		currentADS: ArrDepSet
		nextADS: ArrDepSet
		entries: [TimetableEntry]!
		trainSets: [TrainSet]!
	}
	input TrainInput {
		name: String!
		short: String!
		state: TrainState
		locomotiveLink: ID
		trainSets: [ID!]
		location: MovableLocationInput
	}
	enum TrainState {
		MISSING
		MOVING
		ALLOCATED
		ARRIVED
		READY
		LEAVING
	}
	enum ActionSubjectType {
		TRAIN
		LOCOMOTIVELINK
		WAGONLINK
	}
	union ActionSubject = Train | LocomotiveLink | WagonLink
	interface Action {
		session: Session!
		id: ID!
		from: Date!
		to: Date!
		cancelled: Boolean!
		cancelledReason: String
		usable: Boolean!
		subjectId: String!
		subjectType: ActionSubjectType!
		subject: ActionSubject!
	}
	type ArrDepSet implements Action {
		id: ID!
		session: Session!
		timetable: Timetable
		entry: TimetableEntry

		cancelled: Boolean!
		cancelledReason: String
		usable: Boolean!
		subjectId: String!
		subjectType: ActionSubjectType!
		subject: Train!

		from: Date!
		to: Date!
		scheduledArrival: Date!
		scheduledDeparture: Date!
		actualArrival: Date
		actualDeparture: Date
		arrivalDelay: Int!
		departureDelay: Int!

		train: Train!
		stationLink: StationLink!
		trackLink: StationTrackLink!
		locomotiveLink: Locomotive!
		sets: [TrainSet]!
	}
	input ArrDepSetInput {
		scheduledArrival: Date!
		scheduledDeparture: Date!
		actualArrival: Date
		actualDeparture: Date
		arrivalDelay: Int!
		departureDelay: Int!

		trainId: ID!
		stationLinkId: ID!
		trackLinkId: ID!
		locomotiveLinkId: ID!
		setIds: [ID]!
	}
	enum ADSDelayType {
		ARRIVAL
		DEPARTURE
	}

	type TrainSet {
		id: ID!
		session: Session!
		name: String!
		components: [MovableLink]!
		trains: [Train]!
	}
	input TrainSetInput {
		name: String!
		components: [ID!]!
	}

	interface Movable {
		id: ID!
		model: String!
		couplerType: String!
		name: String
		type: MovableType
		length: Int
		maxSpeed: Int
		owner: User!
	}
	interface MovableLink {
		id: ID!
		session: Session!
		movable: Movable!
		currentLocation: MovableLocation
		currentTrain: Train
	}
	type MovableLocation {
		stationLink: StationLink!
		trackLink: StationTrackLink
	}
	input MovableLocationInput {
		stationLink: ID!
		trackLink: ID
	}
	enum MovableType {
		LOCOMOTIVE
		WAGON
	}

	type Locomotive implements Movable {
		id: ID!
		model: String!
		couplerType: String!
		name: String
		type: MovableType
		length: Int
		maxSpeed: Int
		owner: User!
	}
	type LocomotiveLink implements MovableLink {
		id: ID!
		session: Session!
		movable: Locomotive!
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
		model: String!
		couplerType: String!
		wagonType: WagonType!
		name: String
		type: MovableType
		length: Int
		maxSpeed: Int
		owner: User!
	}
	type WagonLink implements MovableLink {
		id: ID!
		session: Session!
		movable: Wagon!
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
		session: Session!
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
		session: Session!
		timetable: Timetable!
		train: Train!
		stationLink: StationLink!
		trackLink: StationTrackLink!
		locomotiveLink: LocomotiveLink!
		usedFrom: Date!
		usedTill: Date
		repeats: Int!
		start: Date!
		duration: Int!
		sets: [TrainSet]!
		linkedADS: [ArrDepSet]!
	}
	input TimetableEntryInput {
		train: ID!
		stationLink: ID!
		trackLink: ID!
		locomotiveLink: ID!
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
		owning: [Session]!
	}
	type UserLink {
		id: ID!
		session: Session!
		controlling: [LocomotiveLink]!
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
		session: [SessionUserPermissions]!
	}
	input UserPermissionsInput {
		global: Int!
		session: [SessionUserPermissionsInput!]
	}
	type SessionUserPermissions {
		session: Session!
		permissions: Int!
	}
	input SessionUserPermissionsInput {
		session: ID!
		permissions: Int!
	}

	type Session {
		id: ID!
		name: String!
		owner: User!
		activeTimetable: Timetable
	}
	input SessionInput {
		name: String!
	}

	type SessionTime {
		startPoint: Date!
		speedModifier: Int!
		trueElapsed: Float!
		elapsed: Float!
		running: Boolean!
		restricted: Boolean!
	}
	input SessionTimeInput {
		startPoint: Date
		speedModifier: Int
		running: Boolean
		restricted: Boolean
	}
`;

export { typeDefs };
