import chalk from 'chalk'
import { existsSync } from 'fs'
import { $ } from 'zx'

import type { BasicLogger } from './types.js'

interface Config {
	dirtyRoot: string
	logger: BasicLogger
	skipExtractArchives?: boolean
	verbose?: boolean
}

export class ScanStep2 {
	dirtyRoot: string
	logger: BasicLogger
	skipExtractArchives: boolean
	verbose: boolean

	constructor(config: Config) {
		this.verbose = config.verbose ?? false
		this.dirtyRoot = config.dirtyRoot
		this.logger = config.logger
		this.skipExtractArchives = config.skipExtractArchives ?? false
	}

	async run() {
		this.logger.info(
			chalk.yellow(`=== STEP 2: Extract any archives among dirty files`),
		)

		if (!existsSync(this.dirtyRoot)) {
			this.logger.info(`Nothing to be done (no dirty files).`)
			return
		}
		if (this.skipExtractArchives) {
			this.logger.info(chalk.red(`SKIPPING extracting archives.`))
			return
		}

		const verboseFlag = this.verbose ? '--verbose' : ''
		const cmd = ['extractcode', verboseFlag, this.dirtyRoot]
		await $`${cmd}`
	}
}
