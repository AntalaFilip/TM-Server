import cookieParser from "cookie-parser";
import Express from "express";
import { createAuthRouter, Manager } from "../internal";

function createIndexRouter(client: Manager) {
	const router = Express.Router();
	router.use(cookieParser());

	const authRouter = createAuthRouter(client);

	router.use("/auth", authRouter);

	return router;
}

export { createIndexRouter };
