import { json, Response, Router } from "express";
import { authenticate } from "../../middleware/httpauth";
import { TMRealmRequest } from "../../middleware/realmParser";
import stationParser, { TMStationRequest } from "../../middleware/stationParser";
import trackParser, { TMTrackRequest } from "../../middleware/trackParser";
import Client from "../../types/client";
import { checkStationTypeValidity } from "../../types/station";

function createStationRouter(client: Client) {
	const router = Router();
	router.use(json());

	const stationSpecificRouter = Router();
	const trackRouter = Router();
	const trackSpecificRouter = Router();

	router.get('/', getAllStations);
	router.post('/', authenticate.bind(undefined, true, 'station management', client), createStation);
	router.use('/:station', stationParser.bind(undefined, true), stationSpecificRouter);

	stationSpecificRouter.get('/', getStation);
	stationSpecificRouter.patch('/', updateStation);

	stationSpecificRouter.use('/tracks', trackRouter);
	trackRouter.get('/', getAllTracks);
	// trackRouter.post('/');

	trackRouter.use('/:track', trackParser.bind(undefined, true), trackSpecificRouter);
	trackSpecificRouter.get('/', getTrack);
	trackSpecificRouter.patch('/', updateTrack);

	return router;
}

function getAllTracks(req: TMStationRequest, res: Response) {
	const station = req.station;
	const data = station.tracks.map(t => t.metadata());

	return res.status(200).send(data);
}

function updateTrack(req: TMTrackRequest, res: Response) {
	const track = req.track;
	const user = req.auth;
	if (!user.hasPermission('manage stations')) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });

	const toUpdate = req.body;
	const mdf = track.modify(toUpdate, user);
	if (mdf) return res.status(200).send(track.metadata());
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

function getTrack(req: TMTrackRequest, res: Response) {
	const track = req.track;
	const data = track.metadata();

	return res.status(200).send({ ...data, currentTrain: track.currentTrain });
}

function getAllStations(req: TMRealmRequest, res: Response) {
	const realm = req.realm;
	const stations = realm.stationManager.stations;

	const data = stations.map(s => s.metadata());

	res.status(200).send(data);
}

function getStation(req: TMStationRequest, res: Response) {
	const station = req.station;

	const data = station.metadata();
	const trains = station.trains.map(m => m.metadata());

	return res.status(200).send({ ...data, trains });
}

async function createStation(req: TMRealmRequest, res: Response) {
	const user = req.auth;
	const realm = req.realm;
	if (!user.hasPermission('manage stations', realm)) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });
	const smgr = realm.stationManager;

	const data = req.body;
	if (!data.name || typeof data.name != 'string') return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTSTN-EBADPARAM-NAME` } } });
	if (!checkStationTypeValidity(data.stationType)) return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTSTN-EBADPARAM-STATIONTYPE` } } });


	const station = await smgr.create({ realmId: realm.id, managerId: smgr.id, name: data.name, stationType: data.stationType }, user);
	return res.status(201).send(station);
}

async function updateStation(req: TMStationRequest, res: Response) {
	const { auth: user, realm, station } = req;

	if (!user.hasPermission('manage stations', realm)) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });
	const mdf = station.modify(req.body, user);
	if (mdf) return res.status(200).send(station.metadata());
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

export default createStationRouter;