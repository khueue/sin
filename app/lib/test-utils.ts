import { createHash } from 'crypto'
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'

import type { LocalDatabase } from './db.js'
import { testRoot } from './defaults.js'
import type { BasicLogger } from './types.js'

interface TestConfig {
	logger: BasicLogger
	rawLogger: BasicLogger
	dbRoot: string
	dirtyRoot: string
	reportRoot: string
	sourceRoot: string
	nowIso: string
	nowSlug: string
	dbPath: string
	scanCodeBinary: string
	scanCodeOutPath: string
	auditOutPath: string
	acceptedOutPath: string
	attributionsOutPath: string
	dbWrapInGlobalTransaction?: boolean
	skipIsDirtyCheck?: boolean
	skipExtractArchives?: boolean
}

export interface FileStub {
	filePath: string
	contents: string
	inDb?: boolean
	shouldHaveLicenseFindings?: boolean
}

export function testLogger() {
	return {
		info(..._x: any[]) {},
		error(..._x: any[]) {},
		time() {},
		timeEnd() {},
	}
}

export async function createTestConfig(fullname: string) {
	const testId = fullname.toLowerCase().replace(/[^0-9a-z]+/g, '-')
	const sessionDir = `${testRoot}/${testId}`
	const dbRoot = `${sessionDir}/db`
	const dirtyRoot = `${sessionDir}/dirty`
	const reportRoot = `${sessionDir}/report`
	const sourceRoot = `${sessionDir}/src`
	await mkdir(sessionDir, { recursive: true })
	await mkdir(dbRoot)
	await mkdir(dirtyRoot)
	await mkdir(reportRoot)
	await mkdir(sourceRoot)
	const defaults: TestConfig = {
		dbRoot,
		dirtyRoot,
		reportRoot,
		sourceRoot,
		scanCodeBinary: `scancode`,
		scanCodeOutPath: `${reportRoot}/scancode.json`,
		auditOutPath: `${reportRoot}/audit.json`,
		acceptedOutPath: `${reportRoot}/accepted.json`,
		attributionsOutPath: `${reportRoot}/attributions.json`,
		dbPath: `${dbRoot}/test.sqlite`,
		logger: testLogger(),
		rawLogger: testLogger(),
		nowIso: 'nowIso',
		nowSlug: 'nowSlug',
	}
	return defaults
}

export async function prepareSourceFiles(
	db: LocalDatabase,
	testConf: TestConfig,
	files: FileStub[],
) {
	for (const file of files) {
		const fullSourcePath = `${testConf.sourceRoot}/${file.filePath}`
		await writeFileForce(fullSourcePath, file.contents)
		const sha256 = await hashFileContents(fullSourcePath)
		if (file.inDb) {
			db.stmtInsertFile.run({
				file_path: file.filePath,
				content_sha256: sha256,
				content_text: null,
				licenses: null,
				previous_accepted_reason: null,
				current_accepted_reason: null,
				current_accepted_at: null,
				is_legal_document: null,
			})
		}
	}
}

export async function prepareDirtyFiles(
	testConf: TestConfig,
	files: FileStub[],
) {
	for (const file of files) {
		const fullSourcePath = `${testConf.dirtyRoot}/${file.filePath}`
		await writeFileForce(fullSourcePath, file.contents)
	}
}

async function hashFileContents(filePath: string) {
	const contents = await readFile(filePath, {
		encoding: 'base64',
	})
	const hasher = createHash('sha256')
	hasher.update(contents, 'base64')
	const hash = hasher.digest('hex')
	return hash
}

export async function writeFileForce(path: string, contents: string) {
	await mkdir(dirname(path), { recursive: true })
	await writeFile(path, contents, 'utf-8')
}

export async function copyFileForce(sourcePath: string, destPath: string) {
	await mkdir(dirname(destPath), { recursive: true })
	await copyFile(sourcePath, destPath)
}
