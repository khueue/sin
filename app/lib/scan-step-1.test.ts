import { globby } from 'zx';
import { LocalDatabase } from './db';
import { ScanStep1 } from './scan-step-1';
import type { FileStub } from './test-utils';
import { createTestConfig, prepareSourceFiles, testLogger } from './test-utils';

test('2 dirty', async () => {
	const testConf = await createTestConfig();
	const logger = testLogger();

	const db = new LocalDatabase({
		sqlitePath: testConf.dbPath,
		logger,
	});

	const sourceFiles: FileStub[] = [
		{
			filePath: 'a1/with-gpl.txt',
			contents: `
				GPL
			`,
		},
		{
			filePath: 'a1/permissive-only.txt',
			contents: `
				MIT
				BSD
			`,
		},
	];
	await prepareSourceFiles(db, testConf, sourceFiles);

	const step = new ScanStep1({
		db,
		logger,
		sourceRoot: testConf.sourceRoot,
		dirtyRoot: testConf.dirtyRoot,
	});
	await step.run('**');

	const dirtyFiles = await globby(`${testConf.dirtyRoot}/**`);
	expect(dirtyFiles.length).toBe(2);
});

test('1 unchanged, 1 dirty', async () => {
	const testConf = await createTestConfig();
	const logger = testLogger();

	const db = new LocalDatabase({
		sqlitePath: testConf.dbPath,
		logger,
	});

	const sourceFiles = [
		{
			inDb: true,
			filePath: 'a1/with-gpl.txt',
			contents: `
				GPL
			`,
		},
		{
			filePath: 'a1/permissive-only.txt',
			contents: `
				MIT
				BSD
			`,
		},
	];
	await prepareSourceFiles(db, testConf, sourceFiles);

	const step1 = new ScanStep1({
		db,
		logger,
		sourceRoot: testConf.sourceRoot,
		dirtyRoot: testConf.dirtyRoot,
	});
	await step1.run('**');

	const dirtyFiles = await globby(`${testConf.dirtyRoot}/**`);
	expect(dirtyFiles.length).toBe(1);
});
