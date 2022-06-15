import { Server as SIOServer } from "socket.io";
import ResourceManager from "./ResourceManager";

class StationManager extends ResourceManager {
	constructor(id: string, io: SIOServer) {
		super();
	}
}

export default StationManager;