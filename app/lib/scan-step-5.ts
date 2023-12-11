import chalk from 'chalk'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname } from 'path'
import { $ } from 'zx'

import type { LocalDatabase } from './db.js'
import { Detective } from './detective.js'
import { FileTree } from './tree.js'
import type { AnalysedFileRow, BasicLogger } from './types.js'

interface Config {
	db: LocalDatabase
	logger: BasicLogger
	scanCodeBinary: string
	auditOutPath: string
	verbose?: boolean
}

export class ScanStep5 {
	db: LocalDatabase
	logger: BasicLogger
	scanCodeBinary: string
	auditOutPath: string
	verbose: boolean

	constructor(config: Config) {
		this.db = config.db
		this.verbose = config.verbose ?? false
		this.scanCodeBinary = config.scanCodeBinary
		this.logger = config.logger
		this.auditOutPath = config.auditOutPath
	}

	async run() {
		this.logger.info(chalk.yellow(`=== STEP 5: Gather suspicious findings`))

		this.logger.info(`Analysing suspicious files in database ...`)
		const files = this.db.fetchAnalysedFilesNeedingInvestigation()
		const detective = new Detective(
			this.db.allowedSpecificLicenses,
			this.db.allowedLicenseCategories,
		)
		const tree = new FileTree(Object.values(files), detective)
		tree.pruneLevelsWithAcceptedLicenses()
		tree.pruneAllowedFiles()
		tree.pruneEmptyNodes()

		if (this.verbose) {
			await this.runDetailedScans(tree)
		}

		const numFindings = tree.countLeaves()
		this.logger.info(`  done (found ${numFindings}).`)

		const jsonString = tree.toJson()
		await mkdir(dirname(this.auditOutPath), { recursive: true })
		await writeFile(this.auditOutPath, jsonString, 'utf-8')

		this.logger.info(`Investigation saved to: ${this.auditOutPath}`)
		return tree
	}

	async runDetailedScans(tree: FileTree) {
		const stmt = this.db.sqlite.prepare(`
			SELECT content_text
			FROM analysed_files
			WHERE file_path = :file_path
		`)
		await tree.applyToLeaves(tree.root, async (node) => {
			this.logger.info(
				`Running detailed on-the-fly ScanCode analysis for: ${node.filePath}`,
			)
			const row = stmt.get({
				file_path: node.filePath,
			}) as AnalysedFileRow
			const tempDir = tmpdir()
			const pathToScan = `${tempDir}/tmp-content-file`
			await writeFile(pathToScan, row.content_text ?? '', 'utf-8')
			const detailedReportPath = `${tempDir}/tmp-scancode.json`
			const cmd = [
				this.scanCodeBinary,
				'--quiet',
				'--full-root',
				'--license', // Gives license information.
				'--classify', // Gives is_legal flag.
				'--license-text', // Gives a copy of the suspicious lines in file.
				'--json',
				detailedReportPath,
				pathToScan,
			]
			await $`${cmd}`
			const detailedReportJson = await readFile(detailedReportPath, 'utf-8')
			const detailedReport = JSON.parse(detailedReportJson)
			const nodeAsAny = node as any
			for (const scannedFile of detailedReport.files) {
				// ScanCode seems to omit leading slash even with '--full-root'.
				if (`/${scannedFile.path}` === pathToScan) {
					delete scannedFile.path // Misleading (temp path).
					nodeAsAny.scanCodeReport = scannedFile
					break
				}
			}
			if (!nodeAsAny.scanCodeReport) {
				this.logger.error(
					`Could not generate detailed ScanCode report for: ${node.filePath}`,
				)
			}
		})
	}
}
