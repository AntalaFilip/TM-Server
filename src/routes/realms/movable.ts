import { json, Response, Router } from "express";
import { authenticate } from "../../middleware/httpauth";
import locoParser, { TMLocoRequest } from "../../middleware/locoParser";
import { TMRealmRequest } from "../../middleware/realmParser";
import wagonParser, { TMWagonRequest } from "../../middleware/wagonParser";
import Client from "../../types/client";
import Locomotive from "../../types/locomotive";
import Wagon, { checkWagonTypeValidity } from "../../types/wagon";

function createLocomotiveRouter(client: Client) {
	const router = Router();
	const specificRouter = Router();
	router.use(json());
	const auth = authenticate.bind(undefined, true, 'movable management', client);

	router.get('/', getAllLocomotives);
	router.post('/', auth, createLocomotive);
	router.use('/:locomotive', locoParser.bind(undefined, true), specificRouter);

	specificRouter.get('/', getLocomotive)
	specificRouter.patch('/', auth, updateLocomotive);

	return router;
}

function getAllLocomotives(req: TMRealmRequest, res: Response) {
	const realm = req.realm;
	const locos = realm.movableManager.movables.filter((m): m is Locomotive => Locomotive.is(m));

	const meta = locos.map(l => l.metadata());
	return res.status(200).send(meta);
}

function getLocomotive(req: TMLocoRequest, res: Response) {
	const loco = req.locomotive;
	const meta = loco.metadata();

	return res.send({ ...meta, currentLocation: loco.currentLocation, controller: loco.controller });
}

function updateLocomotive(req: TMLocoRequest, res: Response) {
	const locomotive = req.locomotive;
	const user = req.auth;
	if (!user.hasPermission('manage movables')) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });

	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });

	const mdf = locomotive.modify(data, user);
	if (mdf) return getLocomotive(req, res);
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

async function createLocomotive(req: TMRealmRequest, res: Response) {
	const { auth: user, realm } = req;
	if (!user.hasPermission('manage movables')) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });

	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
	if (!checkMovableParams(data, res)) return;

	if (data.controllerId && !realm.client.userManager.get(data.controllerId)) return res.status(400).send({ message: `Invalid controller id!`, error: { code: `EBADREQUEST`, extension: { code: `CRTLCM-EBADPARAM-CONTROLLERID` } } });

	const locomotive = await realm.movableManager.create({ ...data, type: 'locomotive', realmId: realm.id, managerId: realm.movableManager.id }, user) as Locomotive;
	res.status(201).send(locomotive.metadata());
}

function checkMovableParams(data: Record<string, unknown>, res: Response) {
	const badReturn = (extCode: string) => {
		res.status(400).send({ message: `Missing or invalid parameters!`, error: { code: `EBADREQUEST`, extension: { code: extCode } } });
		return false;
	}
	if (data.maxSpeed && typeof data.maxSpeed != 'number') return badReturn(`CRTMVB-EBADPARAM-MAXSPEED`);
	if (data.length && typeof data.length != 'number') return badReturn(`CRTMVB-EBADPARAM-LENGTH`);
	if (typeof data.couplerType != 'string') return badReturn(`CRTMVB-EBADPARAM-COUPLERTYPE`);
	if (typeof data.model != 'string') return badReturn(`CRTMVB-EBADPARAM-MODEL`);
	// if (data.currentLocationMeta && checkMovableLocationMetaExistence(data.currentLocationMeta, realm))
	if (data.name && typeof data.name != 'string') return badReturn(`CRTMVB-EBADPARAM-NAME`);

	return true;
}

function createWagonRouter(client: Client) {
	const router = Router();
	const specificRouter = Router();
	router.use(json());
	const auth = authenticate.bind(undefined, true, 'movable management', client);

	router.get('/', getAllWagons);
	router.post('/', auth, createWagon);
	router.use('/:wagon', wagonParser.bind(undefined, true), specificRouter);

	specificRouter.get('/', getWagon);
	specificRouter.patch('/', auth, updateWagon);

	return router;
}

function getAllWagons(req: TMRealmRequest, res: Response) {
	const realm = req.realm;
	const wagons = realm.movableManager.movables.filter((m): m is Wagon => Wagon.is(m));

	const meta = wagons.map(w => w.metadata());
	return res.status(200).send(meta);
}

function getWagon(req: TMWagonRequest, res: Response) {
	const wagon = req.wagon;
	const meta = wagon.metadata();

	return res.send({ ...meta, currentLocation: wagon.currentLocation });
}

function updateWagon(req: TMWagonRequest, res: Response) {
	const wagon = req.wagon;
	const user = req.auth;
	if (!user.hasPermission('manage movables')) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });

	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });

	const mdf = wagon.modify(data, user);
	if (mdf) return getWagon(req, res);
	else return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
}

async function createWagon(req: TMRealmRequest, res: Response) {
	const { auth: user, realm } = req;
	if (!user.hasPermission('manage movables')) return res.status(403).send({ message: `No permission`, error: { code: `ENOPERM` } });

	const data = req.body;
	if (Array.isArray(data) || typeof data === 'string') return res.status(400).send({ message: `Invalid data`, error: { code: `EBADREQUEST` } });
	if (!checkMovableParams(data, res)) return;

	if (!checkWagonTypeValidity(data.wagonType)) return res.status(400).send({ message: `Missing or invalid parameters!`, error: { code: `EBADREQUEST`, extension: { code: `CRTWGN-EBADPARAM-WAGONTYPE` } } });

	const wagon = await realm.movableManager.create({ ...data, type: 'wagon', realmId: realm.id, managerId: realm.movableManager.id }, user) as Wagon;
	res.status(201).send(wagon.metadata());
}


export { createLocomotiveRouter, createWagonRouter };