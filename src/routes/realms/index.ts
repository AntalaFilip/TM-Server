import Client from "../../types/client";
import Express from "express";

function createRealmsRouter(client: Client) {
	const mainRouter = Express.Router();
	const realmRouter = Express.Router();

	mainRouter.use('/');
	mainRouter.use('/:realm', realmRouter);

	realmRouter.use('/');
	realmRouter.use('/time');
	realmRouter.use('/stations');
	realmRouter.use('/trains');
	realmRouter.use('/trainsets');
	realmRouter.use('/locomotives');
	realmRouter.use('/wagons');


	return mainRouter;
}

export default createRealmsRouter;