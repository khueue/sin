import t from 'tap'
import { $ } from 'zx'

import { Cli } from './cli.js'
import { LocalDatabase } from './db.js'
import { createTestConfig } from './test-utils.js'

$.verbose = false

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

async function createTestCli(fullname: string) {
	const loggerOut = new OutputTracker()
	const rawLoggerOut = new OutputTracker()
	const testConf = await createTestConfig(fullname)
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

t.test('licenses', async (t) => {
	const { cli, loggerOut } = await createTestCli(t.fullname)

	await cli.run(args('licenses', 'allow', 'Ruby License'))
	loggerOut.clearInfos()
	await cli.run(args('licenses', 'list'))
	t.match(loggerOut.infos[0], `Allowed licenses`)
	t.match(loggerOut.infos[0], `Ruby License`)

	await cli.run(args('licenses', 'unallow', 'Ruby License'))
	loggerOut.clearInfos()
	await cli.run(args('licenses', 'list'))
	t.match(loggerOut.infos[0], `Allowed licenses`)
	t.notMatch(loggerOut.infos[0], `Ruby License`)
})

t.test('scan', async (t) => {
	const { cli, loggerOut } = await createTestCli(t.fullname)

	loggerOut.clearInfos()
	await cli.run(args('scan', '--verbose'))
	const output = loggerOut.allInfosAsString()
	t.match(output, `STEP 1`)
	t.match(output, `STEP 2`)
	t.match(output, `STEP 3`)
	t.match(output, `STEP 4`)
})

t.test('audit', async (t) => {
	const { cli, loggerOut } = await createTestCli(t.fullname)

	cli.db.stmtInsertFile.run({
		file_path: 'some/file.txt',
		content_sha256: null,
		content_text: null,
		scancode_entry: null,
		licenses: JSON.stringify(['gpl-1.0']),
		previous_accepted_reason: null,
		current_accepted_reason: null,
		current_accepted_at: null,
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	try {
		await cli.run(args('audit', '--verbose'))
		t.fail('should have thrown')
	} catch (e: unknown) {
		if (e instanceof Error && e.message === 'graceful.audit_with_findings') {
			const output = loggerOut.allInfosAsString()
			t.match(output, `Investigation saved`)
			t.match(output, `found 1`)
		} else {
			t.fail('threw wrong error type')
		}
	}
})

t.test('accepted, csv', async (t) => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli(t.fullname)

	cli.db.stmtInsertFile.run({
		file_path: 'some/accepted.txt',
		content_sha256: null,
		content_text: null,
		scancode_entry: null,
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
	t.match(output, `Finding everything that has been manually accepted`)

	const rawOutput = rawLoggerOut.allInfosAsString()
	t.match(rawOutput, `file_path|reason`)
	t.match(rawOutput, `some/accepted.txt|Looks good!`)
})

t.test('accepted, json', async (t) => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli(t.fullname)

	cli.db.stmtInsertFile.run({
		file_path: 'some/accepted.txt',
		content_sha256: null,
		content_text: null,
		scancode_entry: null,
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
	t.match(output, `Finding everything that has been manually accepted`)
	t.match(output, `Report written`)
})

t.test('view', async (t) => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli(t.fullname)

	cli.db.stmtInsertFile.run({
		file_path: 'some/file-with-stuff.txt',
		content_sha256: null,
		content_text: `
			Content is king!
		`,
		scancode_entry: null,
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
	t.match(rawOutput, `Content is king!`)
})

t.test('accept, exact', async (t) => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli(t.fullname)

	cli.db.stmtInsertFile.run({
		file_path: 'some/file.txt',
		content_sha256: null,
		content_text: `
			I do enjoy some GPL madness.
		`,
		scancode_entry: null,
		licenses: JSON.stringify(['gpl-1.0']),
		previous_accepted_reason: null,
		current_accepted_reason: null,
		current_accepted_at: null,
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(args('accept', 'some/file.txt', 'GPL? Ok, just this once.'))

	const output = loggerOut.allInfosAsString()
	t.match(output, `Accepted: some/file.txt`)
})

t.test('accept, wildcard', async (t) => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli(t.fullname)

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
			scancode_entry: null,
			licenses: JSON.stringify(['gpl-1.0']),
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
	t.match(output, `accepted 3`)
})

t.test('unaccept, exact', async (t) => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli(t.fullname)

	cli.db.stmtInsertFile.run({
		file_path: 'some/file.txt',
		content_sha256: null,
		content_text: `
			I do enjoy some GPL madness.
		`,
		scancode_entry: null,
		licenses: JSON.stringify(['gpl-1.0']),
		previous_accepted_reason: null,
		current_accepted_reason: 'GPL? Ok, just this thrice.',
		current_accepted_at: 'some time',
		is_legal_document: 0,
	})

	loggerOut.clearInfos()
	rawLoggerOut.clearInfos()
	await cli.run(args('unaccept', 'some/file.txt'))

	const output = loggerOut.allInfosAsString()
	t.match(output, `Unaccepted: some/file.txt`)
})

t.test('unaccept, wildcard', async (t) => {
	const { cli, loggerOut, rawLoggerOut } = await createTestCli(t.fullname)

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
			scancode_entry: null,
			licenses: JSON.stringify(['gpl-1.0']),
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
	t.match(output, `unaccepted 3`)
})
