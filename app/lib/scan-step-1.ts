import chalk from 'chalk'
import { createHash } from 'crypto'
import { copyFile, lstat, mkdir, readFile } from 'fs/promises'
import { dirname } from 'path'
import { globby } from 'zx'

import type { LocalDatabase } from './db.js'
import type { AnalysedFile, BasicLogger } from './types.js'

interface Config {
	db: LocalDatabase
	dirtyRoot: string
	logger: BasicLogger
	sourceRoot: string
	skipIsDirtyCheck?: boolean
}

export class ScanStep1 {
	db: LocalDatabase
	dirtyRoot: string
	logger: BasicLogger
	sourceRoot: string
	skipIsDirtyCheck?: boolean
	previouslyAnalysedFiles: Record<string, AnalysedFile> = {}
	dirtyFiles: AnalysedFile[] = []

	constructor(config: Config) {
		this.db = config.db
		this.dirtyRoot = config.dirtyRoot
		this.logger = config.logger
		this.sourceRoot = config.sourceRoot
		this.skipIsDirtyCheck = config.skipIsDirtyCheck ?? false
	}

	async run(scanPattern: string) {
		this.logger.info(chalk.yellow`=== STEP 1: Collect dirty files for scanning`)

		if (this.skipIsDirtyCheck) {
			this.logger.info(
				chalk.red(
					'SKIPPING loading all previously analysed files from database.',
				),
			)
		} else {
			this.logger.info(
				`Loading all previously analysed files from database ...`,
			)
			this.previouslyAnalysedFiles = this.db.fetchAllAnalysedFiles()
			const count = Object.keys(this.previouslyAnalysedFiles).length
			this.logger.info(`  done (found ${count}).`)
		}

		const pattern = `${this.sourceRoot}/${scanPattern}`
		this.logger.info(`Finding all matches for glob ${pattern} ...`)
		const matchedPaths = await globby(pattern)
		this.logger.info(`  done (found ${matchedPaths.length}).`)

		this.logger.info(`Staging dirty files (by comparing content hashes) ...`)
		await this.processInputFiles(matchedPaths)
		this.logger.info(`  done (staged ${this.dirtyFiles.length}).`)

		if (this.dirtyFiles.length) {
			this.logger.info(`Copied dirty files to ${this.dirtyRoot} for scanning.`)
		} else {
			this.logger.info(`Found no dirty files in need of scanning.`)
		}
	}

	async processInputFiles(matchedPaths: string[]) {
		const promises: Promise<AnalysedFile>[] = []
		for (const matchedPath of matchedPaths) {
			const stat = await lstat(matchedPath)
			if (stat.isFile()) {
				const promise = this.processFile(matchedPath)
				promises.push(promise)
			}
		}
		// @todo XXX Use something like p-limit to limit concurrency?
		return Promise.all(promises)
	}

	async processFile(matchedPath: string) {
		const contentSha256 = await this.hashFileContents(matchedPath)
		const relativePath = matchedPath.split(`${this.sourceRoot}/`)[1]

		const file = {
			contentSha256,
			filePath: relativePath,
		} as AnalysedFile

		const previousFile = this.previouslyAnalysedFiles[relativePath]
		if (!previousFile || previousFile.contentSha256 !== contentSha256) {
			file.dirty = true
			this.progressDirtyFile(file)

			// Copy file to dirty dir.
			const dirtyPath = `${this.dirtyRoot}/${relativePath}`
			await mkdir(dirname(dirtyPath), { recursive: true })
			await copyFile(matchedPath, dirtyPath)
		}

		return file
	}

	async hashFileContents(filePath: string) {
		const contents = await readFile(filePath, {
			encoding: 'base64',
		})
		const hasher = createHash('sha256')
		hasher.update(contents, 'base64')
		const hash = hasher.digest('hex')
		return hash
	}

	progressDirtyFile(file: AnalysedFile) {
		this.dirtyFiles.push(file)
		if (this.dirtyFiles.length % 5_000 === 0) {
			this.logger.info(`  staged ${this.dirtyFiles.length} dirty files ...`)
		}
	}
}
