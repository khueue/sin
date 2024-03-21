#!/app/node_modules/.bin/tsx

const label = '- Time, total';
console.time(label);

import { Cli } from './lib/cli.js';
import { LocalDatabase } from './lib/db.js';
import * as defaults from './lib/defaults.js';

const localDb = new LocalDatabase({
	sqlitePath: defaults.dbPath,
	logger: defaults.logger,
	wrapInGlobalTransaction: defaults.dbWrapInGlobalTransaction,
});

let failWithoutThrow = false

const cli = new Cli({
	db: localDb,
	...defaults,
});
cli.run(process.argv)
.catch(async (error: unknown) => {
	if (error instanceof Error && error.message.startsWith('graceful.')) {
		failWithoutThrow = true
	} else {
		throw error
	}
})
.finally(async () => {
	console.timeEnd(label);
	if (failWithoutThrow) {
		process.exit(1)
	}
});
