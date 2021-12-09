import { $ } from 'zx'
import { Cli } from './cli'
import { LocalDatabase } from './db'
import { createTestConfig } from './test-utils'

$.verbose = false
jest.setTimeout(20_000)

class OutputTracker {
	infos: string[] = []
	errors: string[] = []

	pushInfo(x: any[]) {
		const str = JSON.stringify(x)
		this.infos.push(str)
	}

	pushError(x: any[]) {
		const str = JSON.stringify(x)
		this.errors.push(str)
	}

	clearInfos() {
		this.infos = []
	}

	clearErrors() {
		this.errors = []
	}

	allInfosAsString() {
		return this.infos.join('\n') + '\n'
	}

	allErrorsAsString() {
		return this.errors.join('\n') + '\n'
	}
}

async function createTestCli() {
	const loggerOut = new OutputTracker()
	const rawLoggerOut = new OutputTracker()
	const testConf = await createTestConfig()
	testConf.logger = {
		info(...x: any[]) {
			loggerOut.pushInfo(x)
		},
		error(...x: any[]) {
			loggerOut.pushError(x)
		},
		time() {},
		timeEnd() {},
	}
	testConf.rawLogger = {
		info(...x: any[]) {
			rawLoggerOut.pushInfo(x)
		},
		error(...x: any[]) {
			rawLoggerOut.pushError(x)
		},
		time() {},
		timeEnd() {},
	}
	const db = new LocalDatabase({
		sqlitePath: testConf.dbPath,
		logger: testConf.logger,
	})
	const cli = new Cli({
		db,
		...testConf,
	})
	return {
		cli,
		loggerOut,
		rawLoggerOut,
	}
}

function args(...x: string[]) {
	// Simulate process.argv by prefixing with program and script.
	return ['', '', ...x]
}

test('licenses', async () => {
	const { cli, loggerOut } = await createTestCli()

	await cli.run(args('licenses', 'allow', 'specific', 'Ruby License'))
	await cli.run(args('licenses', 'allow', 'category', 'Permissive'))
	loggerOut.clearInfos()
	await cli.run(args('licenses', 'list'))
	expect(loggerOut.infos[0]).toMatch(`Allowed specific licenses`)
	expect(loggerOut.infos[0]).toMatch(`Ruby License`)
	expect(loggerOut.infos[1]).toMatch(`Allowed license categories`)
	expect(loggerOut.infos[1]).toMatch(`Permissive`)

	await cli.run(args('licenses', 'unallow', 'specific', 'Ruby License'))
	await cli.run(args('licenses', 'unallow', 'category', 'Permissive'))
	loggerOut.clearInfos()
	await cli.run(args('licenses', 'list'))
	expect(loggerOut.infos[0]).toMatch(`Allowed specific licenses`)
	expect(loggerOut.infos[0]).not.toMatch(`Ruby License`)
	expect(loggerOut.infos[1]).toMatch(`Allowed license categories`)
	expect(loggerOut.infos[1]).not.toMatch(`Permissive`)
})

test('scan', async () => {
	const { cli, loggerOut } = await createTestCli()

	loggerOut.clearInfos()
	await cli.run(args('scan', '--verbose'))
	const output = loggerOut.allInfosAsString()
	expect(output).toContain(`STEP 1`)
	expect(output).toContain(`STEP 2`)
	expect(output).toContain(`STEP 3`)
	expect(output).toContain(`STEP 4`)
})

test('audit', async () => {
	const { cli, loggerOut } = await createTestCli()

	cli.db.stmtInsertFile.run({
		file_path: 'some/file.txt',
		content_sha256: null,
		content_text: null,
		licenses: JSON.stringify([
			{
				name: 'GPL',
				category: '',
			},
		]),
		previous_accepted_reason: null,
		current_accepted_reason: null,
		current_accepted_at: null,
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	await cli.run(args('audit', '--verbose'))
	const output = loggerOut.allInfosAsString()
	expect(output).toContain(`Investigation saved`)
	expect(output).toContain(`found 1`)
})

test('accepted, csv', async () => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli()

	cli.db.stmtInsertFile.run({
		file_path: 'some/accepted.txt',
		content_sha256: null,
		content_text: null,
		licenses: null,
		previous_accepted_reason: null,
		current_accepted_reason: 'Looks good!',
		current_accepted_at: 'some date',
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(args('accepted'))

	const output = loggerOut.allInfosAsString()
	expect(output).toContain(`Finding everything that has been manually accepted`)

	const rawOutput = rawLoggerOut.allInfosAsString()
	expect(rawOutput).toContain(`file_path|reason`)
	expect(rawOutput).toContain(`some/accepted.txt|Looks good!`)
})

test('accepted, json', async () => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli()

	cli.db.stmtInsertFile.run({
		file_path: 'some/accepted.txt',
		content_sha256: null,
		content_text: null,
		licenses: null,
		previous_accepted_reason: null,
		current_accepted_reason: 'Looks good!',
		current_accepted_at: 'some date',
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(args('accepted', '--output', 'json'))

	const output = loggerOut.allInfosAsString()
	expect(output).toContain(`Finding everything that has been manually accepted`)
	expect(output).toContain(`Report written`)
})

test('view', async () => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli()

	cli.db.stmtInsertFile.run({
		file_path: 'some/file-with-stuff.txt',
		content_sha256: null,
		content_text: `
			Content is king!
		`,
		licenses: null,
		previous_accepted_reason: null,
		current_accepted_reason: null,
		current_accepted_at: null,
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(args('view', 'some/file-with-stuff.txt'))

	const rawOutput = rawLoggerOut.allInfosAsString()
	expect(rawOutput).toContain(`Content is king!`)
})

test('accept, exact', async () => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli()

	cli.db.stmtInsertFile.run({
		file_path: 'some/file.txt',
		content_sha256: null,
		content_text: `
			I do enjoy some GPL madness.
		`,
		licenses: JSON.stringify([
			{
				name: 'GPL',
				category: '',
			},
		]),
		previous_accepted_reason: null,
		current_accepted_reason: null,
		current_accepted_at: null,
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(args('accept', 'some/file.txt', 'GPL? Ok, just this once.'))

	const output = loggerOut.allInfosAsString()
	expect(output).toContain(`Accepted: some/file.txt`)
})

test('accept, wildcard', async () => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli()

	const filePaths = [
		'a/node_modules/file1.txt',
		'a/b/node_modules/file2.txt',
		'a/b/c/node_modules/file3.txt',
		'a/not-me.txt',
	]
	for (const path of filePaths) {
		cli.db.stmtInsertFile.run({
			file_path: path,
			content_sha256: null,
			content_text: `
				I do enjoy some GPL madness.
			`,
			licenses: JSON.stringify([
				{
					name: 'GPL',
					category: '',
				},
			]),
			previous_accepted_reason: null,
			current_accepted_reason: null,
			current_accepted_at: null,
			is_legal_document: 0,
		})
	}

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(
		args('accept', '%/node_modules/%', 'GPL? Ok, just this thrice.'),
	)

	const output = loggerOut.allInfosAsString()
	expect(output).toContain(`accepted 3`)
})

test('unaccept, exact', async () => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli()

	cli.db.stmtInsertFile.run({
		file_path: 'some/file.txt',
		content_sha256: null,
		content_text: `
			I do enjoy some GPL madness.
		`,
		licenses: JSON.stringify([
			{
				name: 'GPL',
				category: '',
			},
		]),
		previous_accepted_reason: null,
		current_accepted_reason: 'GPL? Ok, just this thrice.',
		current_accepted_at: 'some time',
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(args('unaccept', 'some/file.txt'))

	const output = loggerOut.allInfosAsString()
	expect(output).toContain(`Unaccepted: some/file.txt`)
})

test('unaccept, wildcard', async () => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli()

	const filePaths = [
		'a/node_modules/file1.txt',
		'a/b/node_modules/file2.txt',
		'a/b/c/node_modules/file3.txt',
		'a/not-me.txt',
	]
	for (const path of filePaths) {
		cli.db.stmtInsertFile.run({
			file_path: path,
			content_sha256: null,
			content_text: `
				I do enjoy some GPL madness.
			`,
			licenses: JSON.stringify([
				{
					name: 'GPL',
					category: '',
				},
			]),
			previous_accepted_reason: null,
			current_accepted_reason: 'GPL? Ok, just this thrice.',
			current_accepted_at: 'some time',
			is_legal_document: 0,
		})
	}

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(args('unaccept', '%/node_modules/%'))

	const output = loggerOut.allInfosAsString()
	expect(output).toContain(`unaccepted 3`)
})
