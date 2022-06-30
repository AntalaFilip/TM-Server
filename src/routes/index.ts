import Express from 'express';
import Client from '../types/client';
import createAuthRouter from './auth';
import createRealmsRouter from './realms';
import cookieParser from 'cookie-parser';

function createIndexRouter(client: Client) {
	const router = Express.Router();
	router.use(cookieParser());

	const authRouter = createAuthRouter(client);
	// const realmsRouter = createRealmsRouter(client);

	router.use('/auth', authRouter);
	// router.use('/realms', realmsRouter);

	return router;
}

export default createIndexRouter;