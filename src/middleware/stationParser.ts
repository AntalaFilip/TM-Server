import { NextFunction, Response } from "express";
import Station from "../types/station";
import { TMRealmRequest } from "./realmParser";

interface TMStationRequest extends TMRealmRequest {
	station?: Station;
}

function stationParser(
	reject = true,
	req: TMStationRequest,
	res: Response,
	next: NextFunction
) {
	const realm = req.realm;
	const stationId = req.params["station"];
	if (!stationId && reject)
		return res
			.status(404)
			.send({ message: `Missing station ID in request URL` });
	const station = realm.stationManager.get(stationId);
	if (!station && reject)
		return res.status(404).send({ message: `Station does not exist` });

	req.station = station;
	next();
}

export default stationParser;
export { TMStationRequest };
