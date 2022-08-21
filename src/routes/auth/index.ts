import Express from "express";
import { authenticate, TMAuthRequest } from "../../middleware/httpauth";
import Client from "../../types/client";
import login from "./login";
import register from "./register";

function createAuthRouter(client: Client) {
	const router = Express.Router();
	router.use(Express.urlencoded({ extended: true }));

	router.post(
		"/basic/register",
		authenticate.bind(undefined, false, "user administration", client),
		register.bind(undefined, client)
	);
	router.post("/basic/login", login.bind(undefined, client));
	router.post("/basic/logout", (req, res) =>
		res.clearCookie("authToken", { maxAge: 0 }).status(204).send()
	);

	router.get(
		"/basic/me",
		Express.json(),
		authenticate.bind(undefined, true, undefined, client),
		(req: TMAuthRequest, res) => {
			if (!req.auth) return res.status(500).send();
			const data = req.auth.publicMetadata();

			return res.send({ user: { ...data, email: req.auth.email } });
		}
	);

	return router;
}

export default createAuthRouter;
