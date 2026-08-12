export function createSerializedExecutor() {
	let tail = Promise.resolve();

	return async function run<Result>(operation: () => Promise<Result>) {
		const result = tail.catch(() => undefined).then(operation);
		tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	};
}
