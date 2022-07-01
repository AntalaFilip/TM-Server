import Client from "../../types/client";
import Express from "express";
import realmParser from "../../middleware/realmParser";
import createRealmTimeRouter from "./time";
import createStationRouter from "./station";

function createRealmsRouter(client: Client) {
	const mainRouter = Express.Router();
	const realmRouter = Express.Router();

	const timeRouter = createRealmTimeRouter(client);
	const stationRouter = createStationRouter(client);

	// mainRouter.use('/');
	mainRouter.use('/:realm', realmParser.bind(undefined, true, client), realmRouter);

	// realmRouter.use('/');
	realmRouter.use('/time', timeRouter);
	realmRouter.use('/stations', stationRouter);
	// realmRouter.use('/trains');
	// realmRouter.use('/trainsets');
	// realmRouter.use('/locomotives');
	// realmRouter.use('/wagons');


	return mainRouter;
}

export default createRealmsRouter;