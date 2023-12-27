import chalk from 'chalk'
import { mkdir, writeFile } from 'fs/promises'
import { dirname } from 'path'

import type { LocalDatabase } from './db.js'
import { Detective } from './detective.js'
import { FileTree } from './tree.js'
import type { BasicLogger } from './types.js'

interface Config {
	db: LocalDatabase
	logger: BasicLogger
	scanCodeBinary: string
	auditOutPath: string
	verbose?: boolean
	print: boolean
}

export class ScanStep5 {
	db: LocalDatabase
	logger: BasicLogger
	scanCodeBinary: string
	auditOutPath: string
	verbose: boolean
	print: boolean

	constructor(config: Config) {
		this.db = config.db
		this.verbose = config.verbose ?? false
		this.scanCodeBinary = config.scanCodeBinary
		this.logger = config.logger
		this.auditOutPath = config.auditOutPath
		this.print = config.print
	}

	async run() {
		this.logger.info(chalk.yellow(`=== STEP 5: Gather suspicious findings`))

		this.logger.info(`Analysing suspicious files in database ...`)
		const files = this.db.fetchAnalysedFilesNeedingInvestigation(this.verbose)
		const detective = new Detective(this.db.allowedLicenses)
		const tree = new FileTree(Object.values(files), detective)
		tree.pruneLevelsWithAcceptedLicenses()
		tree.pruneAllowedFiles()
		tree.pruneEmptyNodes()

		const numFindings = tree.countLeaves()
		this.logger.info(`  done (found ${numFindings}).`)

		const jsonString = tree.toJson()

		await mkdir(dirname(this.auditOutPath), { recursive: true })
		await writeFile(this.auditOutPath, jsonString, 'utf-8')

		if (this.print) {
			this.logger.info(chalk.blue(`Full audit:`))
			this.logger.info(jsonString)
		}

		this.logger.info(`Investigation saved to: ${this.auditOutPath}`)
		return tree
	}
}
