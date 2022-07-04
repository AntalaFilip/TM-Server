import { NextFunction, Response } from "express";
import Train from "../types/train";
import { TMStationRequest } from "./stationParser";

interface TMTrainRequest extends TMStationRequest {
	train?: Train
}

function trainSetParser(reject = true, req: TMTrainRequest, res: Response, next: NextFunction) {
	const realm = req.realm;
	const trainId = req.params['train'];
	if (!trainId && reject) return res.status(404).send({ message: `Missing train ID in request URL` });
	const train = realm.trainManager.get(trainId);
	if (!train && reject) return res.status(404).send({ message: `Train does not exist` });

	req.train = train;
	next();
}

export default trainSetParser;
export { TMTrainRequest };