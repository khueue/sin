import type { Database as DatabaseT, Options, Statement } from 'better-sqlite3'
import Database from 'better-sqlite3'
import chalk from 'chalk'
import { existsSync } from 'fs'

import type { AnalysedFile, AnalysedFileRow, BasicLogger } from './types.js'

interface Config {
	sqlitePath: string
	logger: BasicLogger
	sqlLogger?(): any
	wrapInGlobalTransaction?: boolean
}

export class LocalDatabase {
	sqlite: DatabaseT
	logger: BasicLogger
	allowedLicenses: string[] = []
	stmtInsertFile: Statement
	stmtUpdateFile: Statement

	constructor(config: Config) {
		this.logger = config.logger

		if (!existsSync(config.sqlitePath)) {
			this.logger.info(
				chalk.magenta(
					`Database ${config.sqlitePath} does not exist, creating it.`,
				),
			)
		}
		const opts: Options = {}
		if (config.sqlLogger) {
			opts.verbose = config.sqlLogger
		}
		this.sqlite = new Database(config.sqlitePath, opts)

		this.bootstrapDb()

		// Performance seems to improve when doing many updates/inserts.
		if (config.wrapInGlobalTransaction) {
			this.sqlite.exec('BEGIN')
			process.on('beforeExit', () => {
				this.sqlite.exec('COMMIT')
			})
		}

		this.stmtInsertFile = this.sqlite.prepare(`
			INSERT INTO analysed_files
			VALUES(
				:file_path,
				:content_sha256,
				:content_text,
				:licenses,
				:previous_accepted_reason,
				:current_accepted_reason,
				:current_accepted_at,
				:is_legal_document
			)
		`)

		this.stmtUpdateFile = this.sqlite.prepare(`
			UPDATE analysed_files
			SET
				content_sha256 = :content_sha256,
				content_text = :content_text,
				licenses = :licenses,
				previous_accepted_reason = current_accepted_reason,
				current_accepted_reason = NULL,
				current_accepted_at = NULL,
				is_legal_document = :is_legal_document
			WHERE file_path = :file_path
		`)
	}

	bootstrapDb() {
		this.sqlite.pragma(`encoding = 'UTF-8'`)

		// Tweaks for extreme performance.
		// See: https://phiresky.github.io/blog/2020/sqlite-performance-tuning/
		// See: https://www.sqlite.org/pragma.html#pragma_synchronous
		// See: https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/compilation.md#bundled-configuration
		this.sqlite.pragma(`cache_size = -1000000`)
		this.sqlite.pragma(`journal_mode = MEMORY`)
		this.sqlite.pragma(`mmap_size = 30000000000`)
		this.sqlite.pragma(`page_size = 32768`)
		this.sqlite.pragma(`synchronous = OFF`)
		this.sqlite.pragma(`temp_store = MEMORY`)
		this.sqlite.pragma(`threads = 32`)

		this.sqlite.exec(`
			CREATE TABLE IF NOT EXISTS analysed_files
			(
				file_path TEXT PRIMARY KEY,
				content_sha256 TEXT,
				content_text TEXT,
				licenses TEXT,
				previous_accepted_reason TEXT,
				current_accepted_reason TEXT,
				current_accepted_at TEXT,
				is_legal_document INTEGER
			)
		`)

		this.sqlite.exec(`
			CREATE TABLE IF NOT EXISTS allowed_licenses
			(
				name TEXT PRIMARY KEY
			)
		`)

		this.loadGlobalSettings()
	}

	loadGlobalSettings() {
		this.allowedLicenses = this.fetchAllowedLicenses()
	}

	fetchAllAnalysedFiles() {
		// NOTE: Skipping content_text, because it's big and irrelevant.
		const stmt = this.sqlite.prepare(`
			SELECT
				file_path,
				content_sha256,
				licenses,
				previous_accepted_reason,
				current_accepted_reason,
				current_accepted_at,
				is_legal_document
			FROM analysed_files
		`)
		return this.fetchAnalysedFiles(stmt)
	}

	fetchAnalysedFilesNeedingInvestigation() {
		// NOTE: Skipping content_text, because it's big and irrelevant.
		const stmt = this.sqlite.prepare(`
			SELECT
				file_path,
				content_sha256,
				licenses,
				previous_accepted_reason,
				current_accepted_reason,
				current_accepted_at,
				is_legal_document
			FROM analysed_files
			WHERE licenses IS NOT NULL
			AND current_accepted_reason IS NULL
			ORDER BY file_path ASC
		`)
		return this.fetchAnalysedFiles(stmt)
	}

	fetchAnalysedFiles(selectStmt: Statement) {
		const files: Record<string, AnalysedFile> = {}
		const rows = selectStmt.all() as AnalysedFileRow[]
		for (const row of rows) {
			const file = this.analysedFileRowToObject(row)
			files[file.filePath] = file
		}
		return files
	}

	analysedFileRowToObject(row: AnalysedFileRow) {
		const file: AnalysedFile = {
			filePath: row.file_path,
		}
		if (row.content_sha256) {
			file.contentSha256 = row.content_sha256
		}
		if (row.content_text) {
			file.contentText = row.content_text
		}
		if (row.licenses) {
			file.licenses = JSON.parse(row.licenses)
		}
		if (row.is_legal_document) {
			file.isLegalDocument = Boolean(row.is_legal_document)
		}
		if (row.current_accepted_at) {
			file.currentAcceptedAt = new Date(row.current_accepted_at)
		}
		if (row.current_accepted_reason) {
			file.currentAcceptedReason = row.current_accepted_reason
		}
		if (row.previous_accepted_reason) {
			file.previousAcceptedReason = row.previous_accepted_reason
		}
		return file
	}

	upsertFile(file: AnalysedFile, exists: boolean) {
		const isLegalDocument = file.isLegalDocument ? 1 : 0
		const licenses = file.licenses?.length
			? JSON.stringify(file.licenses)
			: null
		if (exists) {
			this.stmtUpdateFile.run({
				file_path: file.filePath,
				content_sha256: file.contentSha256,
				content_text: file.contentText,
				licenses,
				is_legal_document: isLegalDocument,
			})
		} else {
			this.stmtInsertFile.run({
				file_path: file.filePath,
				content_sha256: file.contentSha256,
				content_text: file.contentText,
				licenses,
				previous_accepted_reason: null,
				current_accepted_reason: null,
				current_accepted_at: null,
				is_legal_document: isLegalDocument,
			})
		}
	}

	fetchAllowedLicenses() {
		const stmt = this.sqlite.prepare(`
			SELECT name
			FROM allowed_licenses
		`)
		const rows = stmt.all() as {
			name: string
		}[]
		const names = []
		for (const row of rows) {
			names.push(row.name)
		}
		return names
	}
}
