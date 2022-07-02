import Client from "../../types/client";
import Express from "express";
import realmParser from "../../middleware/realmParser";
import createRealmTimeRouter from "./time";
import createStationRouter from "./station";
import { createLocomotiveRouter, createWagonRouter } from "./movable";

function createRealmsRouter(client: Client) {
	const mainRouter = Express.Router();
	const realmRouter = Express.Router();

	const timeRouter = createRealmTimeRouter(client);
	const stationRouter = createStationRouter(client);
	const locoRouter = createLocomotiveRouter(client);
	const wagonRouter = createWagonRouter(client);

	// mainRouter.use('/');
	mainRouter.use('/:realm', realmParser.bind(undefined, true, client), realmRouter);

	// realmRouter.use('/');
	realmRouter.use('/time', timeRouter);
	realmRouter.use('/stations', stationRouter);
	// realmRouter.use('/trains');
	// realmRouter.use('/trainsets');
	realmRouter.use('/locomotives', locoRouter);
	realmRouter.use('/wagons', wagonRouter);


	return mainRouter;
}

export default createRealmsRouter;