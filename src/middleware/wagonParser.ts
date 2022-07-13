import { NextFunction, Response } from "express";
import Wagon from "../types/wagon";
import { TMRealmRequest } from "./realmParser";

interface TMWagonRequest extends TMRealmRequest {
	wagon?: Wagon;
}

function wagonParser(
	reject = true,
	req: TMWagonRequest,
	res: Response,
	next: NextFunction
) {
	const realm = req.realm;
	const wagonId = req.params["wagon"];
	if (!wagonId && reject)
		return res
			.status(404)
			.send({ message: `Missing wagon ID in request URL` });
	const wagon = realm.movableManager.getWagon(wagonId);
	if (!wagon && reject)
		return res.status(404).send({ message: `Wagon does not exist` });

	req.wagon = wagon;
	next();
}

export default wagonParser;
export { TMWagonRequest };
