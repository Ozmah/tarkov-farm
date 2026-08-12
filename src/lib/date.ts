import { Temporal } from "@js-temporal/polyfill";

export const DEFAULT_TIMEZONE = "America/Mexico_City";
export const LOCALE = "en-US-u-ca-gregory-nu-latn";
const CANONICAL_INSTANT_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function parseCanonicalInstant(value: string) {
	try {
		if (!CANONICAL_INSTANT_PATTERN.test(value)) throw new Error();
		const instant = Temporal.Instant.from(value);

		if (instant.toString({ smallestUnit: "millisecond" }) !== value) {
			throw new Error();
		}

		return instant;
	} catch {
		throw new Error("Timestamp must be a canonical UTC instant");
	}
}

export function nowDatetimeLocal() {
	return instantToDatetimeLocal(Temporal.Now.instant());
}

export function instantStringToDatetimeLocal(value: string) {
	return instantToDatetimeLocal(parseCanonicalInstant(value));
}

export function datetimeLocalToInstantString(value: string) {
	try {
		return Temporal.PlainDateTime.from(value)
			.toZonedDateTime(DEFAULT_TIMEZONE)
			.toInstant()
			.toString({ smallestUnit: "millisecond" });
	} catch {
		throw new Error("Publication date and time are invalid");
	}
}

export function formatInstantDate(
	value: string,
	options: Intl.DateTimeFormatOptions,
) {
	const instant = parseCanonicalInstant(value);
	return new Intl.DateTimeFormat(LOCALE, {
		...options,
		timeZone: DEFAULT_TIMEZONE,
	}).format(instant.epochMilliseconds);
}

function instantToDatetimeLocal(instant: Temporal.Instant) {
	return instant
		.toZonedDateTimeISO(DEFAULT_TIMEZONE)
		.toPlainDateTime()
		.toString({ smallestUnit: "minute" });
}
