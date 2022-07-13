import { NextFunction, Response } from "express";
import TrainSet from "../types/trainset";
import { TMStationRequest } from "./stationParser";

interface TMTrainSetRequest extends TMStationRequest {
	trainset?: TrainSet;
}

function trainSetParser(
	reject = true,
	req: TMTrainSetRequest,
	res: Response,
	next: NextFunction
) {
	const realm = req.realm;
	const setId = req.params["trainset"];
	if (!setId && reject)
		return res
			.status(404)
			.send({ message: `Missing train set ID in request URL` });
	const set = realm.trainSetManager.get(setId);
	if (!set && reject)
		return res.status(404).send({ message: `Train set does not exist` });

	req.trainset = set;
	next();
}

export default trainSetParser;
export { TMTrainSetRequest };
