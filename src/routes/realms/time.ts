import { json, Response, Router } from "express";
import { authenticate } from "../../middleware/httpauth";
import { TMRealmRequest } from "../../middleware/realmParser";
import Client from "../../types/client";


function createRealmTimeRouter(client: Client) {
	const router = Router();
	router.use(json());

	router.get('/', getRealmTime);
	router.patch('/', authenticate.bind(undefined, true, 'time management', client), modifyRealmTime);
	router.use('/', (req, res, next) => {
		if (req.method != 'GET' && req.method != 'PATCH') return res.status(405).send();
		else next();
	});


	router.post('/pause', authenticate.bind(undefined, true, 'time management', client), pauseRealmTime);
	router.use('/pause', (req, res, next) => {
		if (req.method != 'POST') return res.status(405).send();
		else next();
	});

	return router;
}

async function getRealmTime(req: TMRealmRequest, res: Response) {
	const realm = req.realm;
	const timeMgr = realm.timeManager;

	return res.send({ data: timeMgr.metadata() });
}

async function modifyRealmTime(req: TMRealmRequest, res: Response) {
	const realm = req.realm;
	const time = realm.timeManager;

	const user = req.auth;
	const toModify = req.body;

	const result = time.modify(toModify, user);
	if (result) return res.status(200).send({ data: time.metadata() });
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

async function pauseRealmTime(req: TMRealmRequest, res: Response) {
	const realm = req.realm;
	const user = req.auth;
	if (!user.hasPermission('control time', realm)) return res.status(403).send({ message: 'No permission', error: { code: 'ENOPERM' } });
	if (req.body.state && typeof req.body.state != 'boolean') return res.status(400).send({ message: `Invalid state parameter`, error: { code: `EBADREQUEST`, extension: { code: 'RLMTIMEPAUSE-EBADPARAM-STATE' } } });

	const currentState = realm.timeManager.running;
	const desiredState = req.body.state ?? !currentState;

	try {
		realm.timeManager.setRunning(desiredState, user);
		res.status(200).send({ data: realm.timeManager.metadata() });
	}
	catch (err) {
		// TODO: better errors
		res.status(500).send(`Internal error`);
		console.error(err);
	}
}

export default createRealmTimeRouter;