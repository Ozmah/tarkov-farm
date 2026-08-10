const APP_ENVIRONMENTS = ["local", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export interface ServerEnvironment {
	appEnvironment: AppEnvironment;
	databasePath: string;
}

export function getServerEnvironment(
	environment: NodeJS.ProcessEnv = process.env,
): ServerEnvironment {
	const appEnvironment = environment.APP_ENV?.trim().toLowerCase();
	const databasePath = environment.DATABASE_PATH?.trim();

	if (!appEnvironment || !databasePath) {
		const missingVariables = [
			...(!appEnvironment ? ["APP_ENV"] : []),
			...(!databasePath ? ["DATABASE_PATH"] : []),
		];

		throw new Error(
			`Missing required environment variables: ${missingVariables.join(", ")}. Copy .env.example to .env and configure it.`,
		);
	}

	if (!isAppEnvironment(appEnvironment)) {
		throw new Error(`APP_ENV must be one of: ${APP_ENVIRONMENTS.join(", ")}.`);
	}

	return {
		appEnvironment,
		databasePath,
	};
}

function isAppEnvironment(value: string | undefined): value is AppEnvironment {
	return APP_ENVIRONMENTS.some((environment) => environment === value);
}
