import t from 'tap'
import { globby } from 'zx'

import { LocalDatabase } from './db.js'
import { ScanStep1 } from './scan-step-1.js'
import type { FileStub } from './test-utils.js'
import {
	createTestConfig,
	prepareSourceFiles,
	testLogger,
} from './test-utils.js'

t.test('2 dirty', async (t) => {
	const testConf = await createTestConfig(t.fullname)
	const logger = testLogger()

	const db = new LocalDatabase({
		sqlitePath: testConf.dbPath,
		logger,
	})

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
	]
	await prepareSourceFiles(db, testConf, sourceFiles)

	const step = new ScanStep1({
		db,
		logger,
		sourceRoot: testConf.sourceRoot,
		dirtyRoot: testConf.dirtyRoot,
	})
	await step.run('**')

	const dirtyFiles = await globby(`${testConf.dirtyRoot}/**`)
	t.equal(dirtyFiles.length, 2)
})

t.test('1 unchanged, 1 dirty', async (t) => {
	const testConf = await createTestConfig(t.fullname)
	const logger = testLogger()

	const db = new LocalDatabase({
		sqlitePath: testConf.dbPath,
		logger,
	})

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
	]
	await prepareSourceFiles(db, testConf, sourceFiles)

	const step1 = new ScanStep1({
		db,
		logger,
		sourceRoot: testConf.sourceRoot,
		dirtyRoot: testConf.dirtyRoot,
	})
	await step1.run('**')

	const dirtyFiles = await globby(`${testConf.dirtyRoot}/**`)
	t.equal(dirtyFiles.length, 1, 'aoeu')
})
