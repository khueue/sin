#!/usr/bin/env tsx

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

const cli = new Cli({
	db: localDb,
	...defaults,
});
cli.run(process.argv).finally(async () => {
	console.timeEnd(label);
});
