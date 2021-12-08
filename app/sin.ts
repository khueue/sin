#!/usr/bin/env ts-node-transpile-only

const label = '- Time, total';
console.time(label);

import { Cli } from './lib/cli';
import { LocalDatabase } from './lib/db';
import * as defaults from './lib/defaults';

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
