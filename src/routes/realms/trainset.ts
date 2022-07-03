import { json, Response, Router } from "express";
import { authenticate } from "../../middleware/httpauth";
import { TMRealmRequest } from "../../middleware/realmParser";
import trainSetParser, { TMTrainSetRequest } from "../../middleware/trainSetParser";
import Client from "../../types/client";
import Movable from "../../types/movable";

function createTrainSetRouter(client: Client) {
	const router = Router();
	router.use(json());
	// this should be train management even though these are trainsets, because we don't have separate permissions
	const auth = authenticate.bind(undefined, true, 'train management', client)

	const setSpecificRouter = Router();

	router.get('/', getAllSets);
	router.post('/', auth, createSet);
	router.use('/:trainset', trainSetParser.bind(undefined, true), setSpecificRouter);

	setSpecificRouter.get('/', getSet);
	setSpecificRouter.patch('/', auth, updateSet);
	return router;
}

function getAllSets(req: TMRealmRequest, res: Response) {
	const realm = req.realm;
	const sets = realm.trainSetManager.trainsets;

	const data = sets.map(s => s.metadata());

	res.status(200).send(data);
}

function getSet(req: TMTrainSetRequest, res: Response) {
	const set = req.trainset;

	const data = set.metadata();

	return res.status(200).send({ ...data, components: set.components.map(c => c.metadata()) });
}

async function createSet(req: TMRealmRequest, res: Response) {
	const user = req.auth;
	const realm = req.realm;
	if (!user.hasPermission('manage trains', realm)) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });
	const smgr = realm.trainSetManager;
	const mmgr = realm.movableManager;

	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
	if (!data.name || typeof data.name != 'string') return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTTST-EBADPARAM-NAME` } } });
	if (!data.components || !Array.isArray(data.components) || !data.components.every((c: unknown) => typeof c === 'string')) return res.status(400).send({ message: `Missing parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTTST-EBADPARAM-COMPONENTS` } } });
	const components = (data.components as Array<string>).map(c => mmgr.get(c)).filter(v => v instanceof Movable);
	if (components.length != data.components.length) return res.status(400).send({ message: `Invalid IDs provided!`, error: { code: `EBADREQUEST`, extension: { code: `CRTTST-ERESNOEXIST-COMPONENTS` } } });

	const trainset = await smgr.create({ realmId: realm.id, managerId: smgr.id, name: data.name, components }, user);
	return res.status(201).send(trainset.metadata());
}

async function updateSet(req: TMTrainSetRequest, res: Response) {
	const { auth: user, realm, trainset } = req;

	if (!user.hasPermission('manage trains', realm)) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });
	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });

	const mdf = await trainset.modify(data, user);
	if (mdf) return getSet(req, res);
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

export default createTrainSetRouter;