import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../helpers/jwt";
import Client from "../types/Client";
import User from "../types/User";

interface TMAuthRequest extends Request {
	auth?: User;
}

async function authenticate(
	reject: boolean,
	authRealm = "trainmanager",
	client: Client,
	req: TMAuthRequest,
	res: Response,
	next: NextFunction
) {
	const authHeader = (req.headers["authorization"] ??
		req.cookies["authToken"]) as string;
	if (reject && !authHeader)
		return res
			.status(401)
			.header("WWW-Authenticate", `jwt realm="${authRealm}"`)
			.send({ message: "Unauthorized", error: { code: "ENOAUTH" } });

	if (!authHeader.startsWith(`Bearer `))
		return res.status(400).send(`Invalid token type!`);

	const token = authHeader.split(" ")[1];
	const vrf = verifyToken(token);
	if (!vrf)
		return res
			.status(401)
			.header("WWW-Authenticate", `jwt realm="${authRealm}"`)
			.send({
				message: "Invalid token",
				error: { code: `EAUTHBADTOKEN` },
			});

	if (typeof vrf != "object" || !vrf.userId)
		return res
			.status(400)
			.send({
				message: "Invalid token",
				error: { code: `EAUTHBADTOKEN` },
			});
	const authUser =
		client.userManager.get(vrf.userId) ??
		(await client.userManager.fromResourceIdentifier(vrf.userId));

	if (!authUser)
		return res
			.status(401)
			.header("WWW-Authenticate", `jwt realm="${authRealm}"`)
			.send({ message: `Invalid user`, error: { code: `EAUTHBADUSER` } });
	if (authUser.disabled)
		return res
			.status(403)
			.send({
				message: `This user is disabled!`,
				error: { code: `EAUTHDISABLEDUSER` },
			});

	req.auth = authUser;

	next();
}

export { authenticate, TMAuthRequest };
