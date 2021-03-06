#!/usr/bin/env ts-node-transpile-only

import chalk from 'chalk'
import { Command } from 'commander'
import { mkdir, writeFile } from 'fs/promises'
import { basename, dirname } from 'path'
import type { LocalDatabase } from './db'
import { Detective } from './detective'
import { ScanStep1 } from './scan-step-1'
import { ScanStep2 } from './scan-step-2'
import { ScanStep3 } from './scan-step-3'
import { ScanStep4 } from './scan-step-4'
import { ScanStep5 } from './scan-step-5'
import { FileTree } from './tree'
import type { AnalysedFile, AnalysedFileRow, BasicLogger } from './types'

interface Config {
	db: LocalDatabase
	logger: BasicLogger
	rawLogger: BasicLogger
	nowIso: string
	nowSlug: string
	dbPath: string
	sourceRoot: string
	dirtyRoot: string
	reportRoot: string
	scanCodeOutPath: string
	auditOutPath: string
	acceptedOutPath: string
	attributionsOutPath: string
	dbWrapInGlobalTransaction?: boolean
	skipIsDirtyCheck?: boolean
	skipExtractArchives?: boolean
}

export class Cli {
	db: LocalDatabase
	program: Command
	logger: BasicLogger
	rawLogger: BasicLogger
	config: Config

	constructor(config: Config) {
		this.db = config.db
		this.program = new Command()
		this.config = config
		this.logger = config.logger
		this.rawLogger = config.rawLogger
	}

	async run(cliArgs: string[]) {
		this.program.name(basename(cliArgs[1]))
		this.program.description(
			[
				`Collects license information from all input files using ScanCode`,
				`and saves the results to a local database for further analysis`,
			].join('\n'),
		)

		this.program
			.command('scan')
			.description(`Scan input and update database with license findings`)
			.option('--verbose', 'Print more info, like dirty files being processed')
			.argument(
				'[pattern]',
				[
					`File pattern (glob) to scan`,
					`Example: my-repo/node_modules/glob/LICENSE`,
					`Example: 'my-repo/**' (quotes avoid any bash expansion)`,
					`Example: 'my-repo/node_modules/g*'`,
				].join('\n'),
				'**',
			)
			.action(async (scanPattern: string, options: any) => {
				await this.scan(scanPattern, options)
			})

		this.program
			.command('audit')
			.description(`Generate report of suspicious files`)
			.option(
				'--verbose',
				'Run on-the-fly ScanCode analysis showing more detailed license info for each finding',
			)
			.action(async (options: any) => {
				await this.audit(options)
			})

		this.program
			.command('view')
			.description(`View contents of a file`)
			.argument(
				'<file_path>',
				`File to view, e.g. my-repo/node_modules/glob/LICENSE`,
			)
			.action(async (filePath: string) => {
				await this.viewFile(filePath)
			})

		this.program
			.command('accepted')
			.description(`Generate report of all manually accepted files`)
			.option(
				'--output <csv|json>',
				`'csv' for a pipe-separated CSV or 'json' for a hierarchical file structure`,
				'csv',
			)
			.action(async (options) => {
				await this.listAccepts(options)
			})

		const descPattern = 'File path: exact or LIKE pattern (with %)'

		this.program
			.command('accept')
			.description(`Mark suspicious files as accepted`)
			.argument('<pattern>', descPattern)
			.argument('<reason>', 'Reason for accepting')
			.action((pattern: string, reason: string) => {
				this.accept(pattern, reason)
			})

		this.program
			.command('unaccept')
			.description(
				`Un-mark previously accepted files so they appear suspicious again`,
			)
			.argument('<pattern>', descPattern)
			.action((pattern: string) => {
				this.unaccept(pattern)
			})

		const licenses = this.program
			.command('licenses')
			.description(`Manage globally allowed licenses (applied on every audit)`)
		const licensesList = licenses
			.command('list')
			.description(`List accepted licenses`)
		const licensesAllow = licenses
			.command('allow')
			.description(`Globally allow a license`)
		const licensesUnallow = licenses
			.command('unallow')
			.description(`Globally unallow a previously allowed license`)

		const descLicenseName = `Name of specific license, e.g. 'Ruby License'`
		const descLicenseCategory = `Name of license category, e.g. 'Public Domain'`

		licensesList.action(() => {
			this.printAllowedLicenses()
		})

		licensesAllow
			.command('specific')
			.description(`Globally allow specific license`)
			.argument('<name>', descLicenseName)
			.action((name: string) => {
				this.allowSpecificLicense(name)
				this.printAllowedLicenses()
			})

		licensesUnallow
			.command('specific')
			.description(`Globally unallow specific license`)
			.argument('<name>', descLicenseName)
			.action((name: string) => {
				this.unallowSpecificLicense(name)
				this.printAllowedLicenses()
			})

		licensesAllow
			.command('category')
			.description(`Globally allow license category`)
			.argument('<name>', descLicenseCategory)
			.action((name: string) => {
				this.allowLicenseCategory(name)
				this.printAllowedLicenses()
			})

		licensesUnallow
			.command('category')
			.description(`Globally unallow license category`)
			.argument('<name>', descLicenseCategory)
			.action((name: string) => {
				this.unallowLicenseCategory(name)
				this.printAllowedLicenses()
			})

		this.program
			.command('attributions')
			.description(
				`[EXPERIMENTAL] Generate report of files needing attribution`,
			)
			.action(async () => {
				await this.listAttributions()
			})

		await this.program.parseAsync(cliArgs)
	}

	async scan(scanPattern: string, options: any) {
		const delimiter = ''.padEnd(72, '=')
		this.rawLogger.info(chalk`{blue ${delimiter}}`)
		this.rawLogger.info()

		const errors: Error[] = []
		const verbose = Boolean(options.verbose)
		let label: string

		label = '- Time, step1'
		this.rawLogger.time(label)
		try {
			const step1 = new ScanStep1({
				db: this.db,
				dirtyRoot: this.config.dirtyRoot,
				logger: this.logger,
				sourceRoot: this.config.sourceRoot,
				skipIsDirtyCheck: this.config.skipIsDirtyCheck ?? false,
			})
			await step1.run(scanPattern)
		} catch (e) {
			throw e
		}
		this.rawLogger.timeEnd(label)
		this.rawLogger.info()

		label = '- Time, step2'
		this.rawLogger.time(label)
		try {
			const step2 = new ScanStep2({
				dirtyRoot: this.config.dirtyRoot,
				logger: this.logger,
				skipExtractArchives: this.config.skipExtractArchives ?? false,
			})
			await step2.run()
		} catch (e: any) {
			errors.push(e)
			this.logger.error(
				chalk`{red STEP 2 failed with errors, continuing anyway.}`,
			)
			this.logger.error(
				chalk`{red This probably just means that a few archives couldn't be decompressed.}`,
			)
		}
		this.rawLogger.timeEnd(label)
		this.rawLogger.info()

		label = '- Time, step3'
		this.rawLogger.time(label)
		try {
			const step3 = new ScanStep3({
				dirtyRoot: this.config.dirtyRoot,
				logger: this.logger,
				scanCodeOutPath: this.config.scanCodeOutPath,
				verbose,
			})
			await step3.run()
		} catch (e: any) {
			errors.push(e)
			this.logger.error(
				chalk`{red STEP 3 failed with errors, continuing anyway.}`,
			)
		}
		this.rawLogger.timeEnd(label)
		this.rawLogger.info()

		label = '- Time, step4'
		this.rawLogger.time(label)
		try {
			const step4 = new ScanStep4({
				db: this.db,
				dirtyRoot: this.config.dirtyRoot,
				logger: this.logger,
				scanCodeOutPath: this.config.scanCodeOutPath,
			})
			await step4.run()
		} catch (e) {
			throw e
		}
		this.rawLogger.timeEnd(label)
		this.rawLogger.info()

		this.logger.info(chalk`{blue Run 'audit' to investigate any findings.}`)

		if (errors.length) {
			this.rawLogger.info()
			this.logger.error(`Errors during processing:`)
			for (const e of errors) {
				this.logger.error(e)
			}
		}
	}

	async audit(options: any) {
		const step5 = new ScanStep5({
			db: this.db,
			auditOutPath: this.config.auditOutPath,
			logger: this.logger,
			verbose: options.verbose ?? false,
		})
		await step5.run()
	}

	async saveFile(path: string, contents: string) {
		await mkdir(dirname(path), { recursive: true })
		await writeFile(path, contents, 'utf-8')
	}

	async viewFile(filePath: string) {
		const stmt = this.db.sqlite.prepare(`
			SELECT * FROM analysed_files
			WHERE file_path = :file_path
		`)
		const row = stmt.get({
			file_path: filePath,
		}) as AnalysedFileRow
		if (!row) {
			this.logger.error(`Found no such file: ${filePath}`)
			return
		}
		if (!row.content_text) {
			if (!row.licenses) {
				this.logger.error(
					`File has no license info, therefore its content has not been saved.`,
				)
			} else {
				this.logger.error(`This file seems to be empty! Strange.`)
			}
			return
		}
		this.rawLogger.info(chalk`{blue ${''.padEnd(72, '>')}}`)
		this.rawLogger.info()
		this.rawLogger.info(row.content_text?.trim())
		this.rawLogger.info()
		this.rawLogger.info(chalk`{blue ${''.padEnd(72, '<')}}`)
	}

	async listAccepts(options: any) {
		if (options.output === 'json') {
			await this.listAcceptsAsJson()
		} else {
			await this.listAcceptsAsCsv()
		}
	}

	async listAcceptsAsCsv() {
		this.logger.info(`Finding everything that has been manually accepted ...`)
		const stmt = this.db.sqlite.prepare(`
			SELECT
				file_path,
				is_legal_document,
				current_accepted_reason,
				current_accepted_at
			FROM analysed_files
			WHERE current_accepted_reason IS NOT NULL
			ORDER BY file_path ASC
		`)
		const rows = stmt.all() as AnalysedFileRow[]
		const accepts: Record<
			string,
			{
				affectedPaths: number
				topmostPath: string
				reason: string
			}
		> = {}
		for (const row of rows) {
			const ts = row.current_accepted_at!
			if (!accepts[ts]) {
				accepts[ts] = {
					affectedPaths: 0,
					topmostPath: row.file_path,
					reason: row.current_accepted_reason!,
				}
			}
			accepts[ts].affectedPaths += 1
			const dirs = dirname(row.file_path)
			if (dirs.length < dirname(accepts[ts].topmostPath).length) {
				accepts[ts].topmostPath = row.file_path
			}
		}
		const acceptsSorted = Object.values(accepts).sort((a, b) =>
			a.topmostPath < b.topmostPath ? -1 : 1,
		)
		this.rawLogger.info(['file_path', 'reason'].join('|'))
		for (const accept of acceptsSorted) {
			let values: string[]
			if (accept.affectedPaths === 1) {
				values = [accept.topmostPath, accept.reason]
			} else {
				const path =
					dirname(accept.topmostPath) + `/{${accept.affectedPaths} files}`
				values = [path, accept.reason]
			}
			this.rawLogger.info(values.join('|'))
		}
	}

	async listAcceptsAsJson() {
		this.logger.info(`Finding everything that has been manually accepted ...`)
		const stmt = this.db.sqlite.prepare(`
			SELECT
				file_path,
				is_legal_document,
				current_accepted_reason,
				current_accepted_at
			FROM analysed_files
			WHERE current_accepted_reason IS NOT NULL
			ORDER BY file_path ASC
		`)
		const rows = stmt.all() as AnalysedFileRow[]
		const files: AnalysedFile[] = []
		for (const row of rows) {
			const file = this.db.analysedFileRowToObject(row)
			files.push(file)
		}

		const detective = new Detective([], [])
		const tree = new FileTree(Object.values(files), detective)
		if (Object.keys(tree.root).length) {
			const json = tree.toJson()
			await this.saveFile(this.config.acceptedOutPath, json)
			this.logger.info(`Report written to: ${this.config.acceptedOutPath}`)
		} else {
			this.logger.info(`Nothing has been manually accepted.`)
		}
	}

	accept(pattern: string, reason: string) {
		if (pattern.includes('%')) {
			this.acceptWildcard(pattern, reason)
		} else {
			this.acceptExact(pattern, reason)
		}
	}

	acceptWildcard(likePattern: string, reason: string) {
		this.logger.info(`Accepting suspicious files (using LIKE) ...`)
		const stmtSelect = this.db.sqlite.prepare(`
			SELECT
				file_path,
				content_sha256,
				licenses,
				previous_accepted_reason,
				current_accepted_reason,
				current_accepted_at,
				is_legal_document
			FROM analysed_files
			WHERE file_path LIKE :like_pattern
			AND licenses IS NOT NULL
		`)
		const rows = stmtSelect.all({
			like_pattern: likePattern,
		}) as AnalysedFileRow[]
		const stmtUpdate = this.db.sqlite.prepare(`
			UPDATE analysed_files
			SET
				previous_accepted_reason = current_accepted_reason,
				current_accepted_reason = :reason,
				current_accepted_at = :at
			WHERE file_path = :file_path
		`)
		reason = reason.trim()
		const verbose = this.program.opts().verbose
		const files: AnalysedFile[] = []
		const detective = new Detective(
			this.db.allowedSpecificLicenses,
			this.db.allowedLicenseCategories,
		)
		for (const row of rows) {
			const file = this.db.analysedFileRowToObject(row)
			if (detective.fileNeedsInvestigation(file)) {
				files.push(file)
				if (verbose) {
					this.logger.info(file.filePath)
				}
				stmtUpdate.run({
					reason,
					at: this.config.nowIso,
					file_path: file.filePath,
				})
			}
		}
		this.logger.info(`  done (accepted ${files.length}).`)
	}

	acceptExact(filePath: string, reason: string) {
		const stmt = this.db.sqlite.prepare(`
			UPDATE analysed_files
			SET
				previous_accepted_reason = current_accepted_reason,
				current_accepted_reason = :reason,
				current_accepted_at = :at
			WHERE file_path = :file_path
			AND licenses IS NOT NULL
		`)
		const result = stmt.run({
			file_path: filePath,
			reason: reason.trim(),
			at: this.config.nowIso,
		})
		if (!result.changes) {
			this.logger.error(`Found no such file: ${filePath}`)
			this.logger.error(`Did you mean to use LIKE wildcard (%)?`)
			return
		}
		this.logger.info(`Accepted: ${filePath}`)
	}

	unaccept(pattern: string) {
		if (pattern.includes('%')) {
			this.unacceptWildcard(pattern)
		} else {
			this.unacceptExact(pattern)
		}
	}

	unacceptWildcard(likePattern: string) {
		this.logger.info(`Unaccepting files (using LIKE) ...`)
		const stmtSelect = this.db.sqlite.prepare(`
			SELECT
				file_path,
				content_sha256,
				licenses,
				previous_accepted_reason,
				current_accepted_reason,
				current_accepted_at,
				is_legal_document
			FROM analysed_files
			WHERE file_path LIKE :like_pattern
			AND licenses IS NOT NULL
			AND current_accepted_reason IS NOT NULL
		`)
		const rows = stmtSelect.all({
			like_pattern: likePattern,
		}) as AnalysedFileRow[]
		const stmtUpdate = this.db.sqlite.prepare(`
			UPDATE analysed_files
			SET
				previous_accepted_reason = current_accepted_reason,
				current_accepted_reason = NULL,
				current_accepted_at = NULL
			WHERE file_path = :file_path
		`)
		const verbose = this.program.opts().verbose
		const files: AnalysedFile[] = []
		for (const row of rows) {
			const file = this.db.analysedFileRowToObject(row)
			files.push(file)
			if (verbose) {
				this.logger.info(file.filePath)
			}
			stmtUpdate.run({
				file_path: file.filePath,
			})
		}
		this.logger.info(`  done (unaccepted ${files.length}).`)
	}

	unacceptExact(filePath: string) {
		const stmt = this.db.sqlite.prepare(`
			UPDATE analysed_files
			SET
				previous_accepted_reason = current_accepted_reason,
				current_accepted_reason = NULL,
				current_accepted_at = NULL
			WHERE file_path = :file_path
			AND licenses IS NOT NULL
		`)
		const result = stmt.run({
			file_path: filePath,
		})
		if (!result.changes) {
			this.logger.error(`Found no such file: ${filePath}`)
			this.logger.error(`Did you mean to use LIKE wildcard (%)?`)
			return
		}
		this.logger.info(`Unaccepted: ${filePath}`)
	}

	allowSpecificLicense(name: string) {
		const stmt = this.db.sqlite.prepare(`
			INSERT INTO accepted_license_names(name) VALUES(:name)
			ON CONFLICT(name) DO
			UPDATE SET name = :name
		`)
		const results = stmt.run({
			name,
		})
		if (!results) {
			this.logger.error(`Something went wrong.`)
			throw new Error(`Could not save specific license allow: ${name}`)
		}
		this.logger.info(`Globally accepting specific license: ${name}`)
	}

	unallowSpecificLicense(name: string) {
		const stmt = this.db.sqlite.prepare(`
			DELETE FROM accepted_license_names
			WHERE name = :name
		`)
		const results = stmt.run({
			name,
		})
		if (!results) {
			this.logger.error(`Something went wrong.`)
			throw new Error(`Could not save license category allow: ${name}`)
		}
		this.logger.info(`No longer globally accepting specific license: ${name}`)
	}

	allowLicenseCategory(name: string) {
		const stmt = this.db.sqlite.prepare(`
			INSERT INTO accepted_license_categories(name) VALUES(:name)
			ON CONFLICT(name) DO
			UPDATE SET name = :name
		`)
		const results = stmt.run({
			name,
		})
		if (!results) {
			this.logger.error(`Something went wrong.`)
			return
		}
		this.logger.info(`Globally accepting license category: ${name}`)
	}

	unallowLicenseCategory(name: string) {
		const stmt = this.db.sqlite.prepare(`
			DELETE FROM accepted_license_categories
			WHERE name = :name
		`)
		const results = stmt.run({
			name,
		})
		if (!results) {
			this.logger.error(`Something went wrong.`)
			return
		}
		this.logger.info(`No longer globally accepting license category: ${name}`)
	}

	printAllowedLicenses() {
		this.db.loadGlobalSettings()
		const names = this.db.allowedSpecificLicenses
		const categories = this.db.allowedLicenseCategories
		this.logger.info(`Allowed specific licenses:`, names)
		this.logger.info(`Allowed license categories:`, categories)
	}

	async listAttributions() {
		this.logger.info(
			`Finding everything that seems to mention licenses requiring attribution ...`,
		)
		const stmt = this.db.sqlite.prepare(`
			SELECT
				file_path,
				licenses,
				is_legal_document,
				current_accepted_reason,
				current_accepted_at
			FROM analysed_files
			WHERE (
				file_path LIKE '%license%'
				OR
				is_legal_document = 1
			)
			AND licenses LIKE '%Creative Commons%'
			AND licenses NOT LIKE '%CC0 1.0%'
			ORDER BY file_path
		`)
		const rows = stmt.all({}) as AnalysedFileRow[]
		const sets = {
			node: new Set<string>(),
			ruby: new Set<string>(),
		}
		for (const row of rows) {
			if (row.file_path.includes('/node_modules/')) {
				const packageName = row.file_path
					.split('/node_modules/')
					.slice(-1)[0]
					.split('/')[0]
				sets.node.add(packageName)
			} else if (row.file_path.includes('/_gems/')) {
				const packageName = row.file_path.split('/_gems/')[1].split('/')[1]
				sets.ruby.add(packageName)
			}
		}
		this.rawLogger.info('Node:', Array(sets.node).sort())
		this.rawLogger.info('Ruby:', Array(sets.ruby).sort())
	}
}
