import Express from "express";
import Client from "../types/client";
import createAuthRouter from "./auth";
import cookieParser from "cookie-parser";

function createIndexRouter(client: Client) {
	const router = Express.Router();
	router.use(cookieParser());

	const authRouter = createAuthRouter(client);

	router.use("/auth", authRouter);

	return router;
}

export default createIndexRouter;
