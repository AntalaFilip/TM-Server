import { json, Response, Router } from "express";
import { authenticate } from "../../middleware/httpauth";
import { TMRealmRequest } from "../../middleware/realmParser";
import trainParser, { TMTrainRequest } from "../../middleware/trainParser";
import Client from "../../types/client";
import { checkTrainStateValidity } from "../../types/train";
import TrainSet from "../../types/trainset";

function createTrainRouter(client: Client) {
	const router = Router();
	router.use(json());
	const auth = authenticate.bind(undefined, true, 'train management', client)

	const trainSpecificRouter = Router();

	router.get('/', getAllTrains);
	router.post('/', auth, createTrain);
	router.use('/:train', trainParser.bind(undefined, true), trainSpecificRouter);

	trainSpecificRouter.get('/', getTrain);
	trainSpecificRouter.patch('/', auth, updateTrain);
	trainSpecificRouter.patch('/state', auth, updateTrainState);
	trainSpecificRouter.get('/checks', getTrainChecks);

	return router;
}

function getAllTrains(req: TMRealmRequest, res: Response) {
	const realm = req.realm;
	const trains = realm.trainManager.trains;

	const data = trains.map(t => t.metadata());

	res.status(200).send(data);
}

function getTrain(req: TMTrainRequest, res: Response) {
	const train = req.train;

	const data = train.metadata();

	return res.status(200).send(
		{
			...data,
			currentEntry: train.currentEntry,
			location: train.location,
			locomotive: train.locomotive,
			trainSets: train.trainSets,
		}
	);
}

async function createTrain(req: TMRealmRequest, res: Response) {
	const user = req.auth;
	const realm = req.realm;
	if (!user.hasPermission('manage trains', realm)) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });
	const tmgr = realm.trainManager;
	const mmgr = realm.movableManager;
	const smgr = realm.trainSetManager;

	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
	if (!data.name || typeof data.name != 'string') return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTTRN-EBADPARAM-NAME` } } });
	if (!data.short || typeof data.short != 'string') return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTTRN-EBADPARAM-SHORT` } } });
	const locomotive = mmgr.getLoco(data.locomotiveId);
	if (data.locomotiveId && !locomotive) return res.status(400).send({ message: `Invalid locomotive ID!`, error: { code: `EBADREQUEST`, extension: { code: `CRTTRN-ERESNOEXIST-LOCOMOTIVEID` } } });

	if (data.trainSetIds && (!Array.isArray(data.trainSetIds) || !data.trainSetIds.every((c: unknown) => typeof c === 'string'))) return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTTRN-EBADPARAM-TRAINSETIDS` } } });
	const trainSets = (data.trainSetIds as Array<string>)?.map(c => smgr.get(c))?.filter(v => v instanceof TrainSet);
	if (trainSets?.length != data.trainSetIds?.length) return res.status(400).send({ message: `Invalid IDs provided!`, error: { code: `EBADREQUEST`, extension: { code: `CRTTRN-ERESNOEXIST-TRAINSETIDS` } } });

	const train = await tmgr.create({ realmId: realm.id, managerId: tmgr.id, name: data.name, short: data.short, locomotive, state: 'MISSING', trainSets }, user);
	return res.status(201).send(train.metadata());
}

async function updateTrain(req: TMTrainRequest, res: Response) {
	const { auth: user, realm, train } = req;

	if (!user.hasPermission('manage trains', realm)) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });
	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });

	const mdf = await train.modify(data, user);
	if (mdf) return getTrain(req, res);
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

function updateTrainState(req: TMTrainRequest, res: Response) {
	const { auth: user, realm, train } = req;
	if (!user.hasPermission('manage trains', realm) && train.location?.station?.dispatcher != user && train.locomotive?.controller != user) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });
	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });

	const state = data.state;
	if (!checkTrainStateValidity(state)) return res.status(400).send({ message: `Invalid state`, error: { code: `EBADREQUEST` } });

	train.updateTrainState(state);
	return getTrain(req, res);
}

function getTrainChecks(req: TMTrainRequest, res: Response) {
	const { train } = req;
	try {
		train.runStateChecks();
		return res.status(200).send({ result: 'SUCCESS' });
	}
	catch (err) {
		// TODO: add internal error check after error refactoring
		return res.status(200).send({ result: 'FAILURE', error: err });
	}
}

export default createTrainRouter;