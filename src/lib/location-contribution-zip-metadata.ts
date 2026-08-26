import { Temporal } from "@js-temporal/polyfill";

const ZIP_EPOCH = Temporal.PlainDateTime.from({
	day: 1,
	hour: 0,
	microsecond: 0,
	millisecond: 0,
	minute: 0,
	month: 1,
	nanosecond: 0,
	second: 0,
	year: 1980,
});

// fflate accepts this local date-time string and writes its fields directly
// into ZIP's timezone-free DOS timestamp representation.
export const LOCATION_CONTRIBUTION_ZIP_MTIME = ZIP_EPOCH.toString();
