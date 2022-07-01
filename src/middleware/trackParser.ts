import { NextFunction, Response } from "express";
import StationTrack from "../types/track";
import { TMStationRequest } from "./stationParser";

interface TMTrackRequest extends TMStationRequest {
	track?: StationTrack
}

function trackParser(reject = true, req: TMTrackRequest, res: Response, next: NextFunction) {
	const station = req.station;
	const trackId = req.params['track'];
	if (!trackId && reject) return res.status(404).send({ message: `Missing track ID in request URL` });
	const track = station.tracks.get(trackId);
	if (!track && reject) return res.status(404).send({ message: `Track does not exist` });

	req.track = track;
	next();
}

export default trackParser;
export { TMTrackRequest };