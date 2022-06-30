import { NextFunction, Response } from "express";
import Client from "../types/client";
import { TMRequest } from "./httpauth";

function realmParser(reject = true, client: Client, req: TMRequest, res: Response, next: NextFunction) {
	const realmId = req.params['realm'];
	if (!realmId && reject) return res.status(404).send({ message: `Missing realm ID in request URL` });
	const realm = client.realms.get(realmId);
	if (!realm && reject) return res.status(404).send({ message: `Realm does not exist` });

	req.realm = realm;
	next();
}

export default realmParser;