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
	const auth = authenticate.bind(undefined, true, 'station management', client)

	const stationSpecificRouter = Router();
	const trackRouter = Router();
	const trackSpecificRouter = Router();

	router.get('/', getAllStations);
	router.post('/', auth, createStation);
	router.use('/:station', stationParser.bind(undefined, true), stationSpecificRouter);

	stationSpecificRouter.get('/', getStation);
	stationSpecificRouter.patch('/', auth, updateStation);

	stationSpecificRouter.use('/tracks', trackRouter);
	trackRouter.get('/', getAllTracks);
	trackRouter.post('/', auth, createTrack);

	trackRouter.use('/:track', trackParser.bind(undefined, true), trackSpecificRouter);
	trackSpecificRouter.get('/', getTrack);
	trackSpecificRouter.patch('/', auth, updateTrack);

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

	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });

	const mdf = track.modify(data, user);
	if (mdf) return getTrack(req, res);
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

async function createTrack(req: TMStationRequest, res: Response) {
	const { station, auth: user, realm } = req;
	if (!user.hasPermission('manage stations')) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });

	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });

	if (typeof data.name != 'string') return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTSTNTRK-EBADPARAM-NAME` } } });
	if (data.length && typeof data.length != 'number') return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTSTNTRK-EBADPARAM-LENGTH` } } });
	if (typeof data.usedForParking != 'boolean') return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTSTNTRK-EBADPARAM-USEDFORPARKING` } } });

	const track = await station.addTrack({ realmId: realm.id, managerId: realm.stationManager.id, name: data.name, stationId: station.id, length: data.length, usedForParking: data.usedForParking });
	res.status(201).send(track.metadata());
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
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
	if (!data.name || typeof data.name != 'string') return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTSTN-EBADPARAM-NAME` } } });
	if (!checkStationTypeValidity(data.stationType)) return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTSTN-EBADPARAM-STATIONTYPE` } } });


	const station = await smgr.create({ realmId: realm.id, managerId: smgr.id, name: data.name, stationType: data.stationType }, user);
	return res.status(201).send(station.metadata());
}

async function updateStation(req: TMStationRequest, res: Response) {
	const { auth: user, realm, station } = req;

	if (!user.hasPermission('manage stations', realm)) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });
	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });

	const mdf = station.modify(data, user);
	if (mdf) return getStation(req, res);
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

export default createStationRouter;