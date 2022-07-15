// import c from "chalk";
import c from "chalk";
import Redis from "./redis";

type LogLevel = "VERBOSE" | "DEBUG" | "INFO" | "WARNING" | "ERROR" | "FATAL";
type NodeEnv = "PRODUCTION" | "DEVELOPMENT" | "TESTING";

class TMLogger {
	public readonly name: string;
	public readonly short: string;
	public readonly env: NodeEnv;
	public readonly logVerbose: boolean;
	public readonly logDebug: boolean;
	public readonly db: Redis;

	constructor(name: string, short?: string) {
		this.name = name;
		this.short = short ?? name;
		this.db = new Redis(`log:core`);
		this.env = process.env.NODE_ENV as NodeEnv;
		this.logVerbose = process.env.LOG_VERBOSE === "true" ?? false;
		this.logDebug = process.env.LOG_DEBUG === "true" ?? false;
	}

	_formatTexts(level: LogLevel, ...texts: string[]) {
		return texts
			.flatMap((l) => l.split("\n"))
			.map(
				(l) =>
					`${new Date().toISOString()} ${this.short}/${level}: ${l}`
			)
			.join("\n");
	}

	_logToConsole(level: LogLevel, ...log: string[]) {
		const text = this._formatTexts(level, ...log);
		switch (level) {
			case "VERBOSE":
				this.logVerbose && console.debug(c.magenta(text));
				break;
			case "DEBUG":
				this.logDebug && console.debug(c.gray(text));
				break;
			case "INFO":
				console.info(text);
				break;
			case "WARNING":
				console.warn(c.yellow(text));
				break;
			case "ERROR":
				console.error(c.red(text));
				break;
			case "FATAL":
				console.error(c.bgBlack.bold.red(text));
				break;
		}
	}

	verbose(...log: string[]) {
		this._logToConsole("VERBOSE", ...log);
		this.toDB("VERBOSE", ...log);
	}

	debug(...log: string[]) {
		this._logToConsole("DEBUG", ...log);
		this.toDB("DEBUG", ...log);
	}

	info(...log: string[]) {
		this._logToConsole("INFO", ...log);
		this.toDB("INFO", ...log);
	}

	warn(...log: string[]) {
		this._logToConsole("WARNING", ...log);
		this.toDB("WARNING", ...log);
	}

	error(...log: string[]) {
		this._logToConsole("ERROR", ...log);
		this.toDB("ERROR", ...log);
	}

	fatal(...log: string[]) {
		this._logToConsole("FATAL", ...log);
		this.toDB("FATAL", ...log);
	}

	async toDB(level: LogLevel, ...audit: string[]) {
		const texts = this._formatTexts(level, ...audit);
		await this.db.redis.xadd(
			`${this.db.name}:${this.name}`,
			"*",
			...texts.split("\n").flatMap((l) => [level, l])
		);
	}
}

export default TMLogger;
