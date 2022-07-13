import { NextFunction, Response } from "express";
import Locomotive from "../types/locomotive";
import { TMRealmRequest } from "./realmParser";

interface TMLocoRequest extends TMRealmRequest {
	locomotive?: Locomotive;
}

function locoParser(
	reject = true,
	req: TMLocoRequest,
	res: Response,
	next: NextFunction
) {
	const realm = req.realm;
	const locoId = req.params["locomotive"];
	if (!locoId && reject)
		return res
			.status(404)
			.send({ message: `Missing locomotive ID in request URL` });
	const loco = realm.movableManager.getLoco(locoId);
	if (!loco && reject)
		return res.status(404).send({ message: `Locomotive does not exist` });

	req.locomotive = loco;
	next();
}

export default locoParser;
export { TMLocoRequest };
