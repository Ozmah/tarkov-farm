const APP_ENVIRONMENTS = ["local", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export interface ServerEnvironment {
	appEnvironment: AppEnvironment;
}

export function getServerEnvironment(
	environment: NodeJS.ProcessEnv = process.env,
): ServerEnvironment {
	const appEnvironment = environment.APP_ENV?.trim().toLowerCase();
	if (!appEnvironment) {
		throw new Error(
			"Missing required environment variables: APP_ENV. Copy .env.example to .env and configure it.",
		);
	}

	if (!isAppEnvironment(appEnvironment)) {
		throw new Error(`APP_ENV must be one of: ${APP_ENVIRONMENTS.join(", ")}.`);
	}

	return {
		appEnvironment,
	};
}

function isAppEnvironment(value: string | undefined): value is AppEnvironment {
	return APP_ENVIRONMENTS.some((environment) => environment === value);
}
