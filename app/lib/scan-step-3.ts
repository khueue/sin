import chalk from 'chalk'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { cpus } from 'os'
import { dirname } from 'path'
import { $ } from 'zx'

import type { BasicLogger } from './types.js'

interface Config {
	dirtyRoot: string
	logger: BasicLogger
	scanCodeBinary: string
	scanCodeOutPath: string
	verbose?: boolean
}

export class ScanStep3 {
	dirtyRoot: string
	logger: BasicLogger
	scanCodeBinary: string
	scanCodeOutPath: string
	verbose: boolean

	constructor(config: Config) {
		this.dirtyRoot = config.dirtyRoot
		this.logger = config.logger
		this.scanCodeBinary = config.scanCodeBinary
		this.scanCodeOutPath = config.scanCodeOutPath
		this.verbose = config.verbose ?? false
	}

	async run() {
		this.logger.info(chalk.yellow(`=== STEP 3: Run ScanCode on dirty files`))

		if (!existsSync(this.dirtyRoot)) {
			this.logger.info(`Nothing to be done (no dirty files).`)
			return
		}

		await mkdir(dirname(this.scanCodeOutPath), { recursive: true })

		const verboseFlag = this.verbose ? '--verbose' : ''
		const cmd = [
			this.scanCodeBinary,
			verboseFlag,
			'--processes',
			cpus().length,
			'--strip-root', // Strips dirtyRoot from all paths.
			'--info', // Gives sha256 of file contents.
			'--license', // Gives license information.
			'--classify', // Gives is_legal flag.
			'--json-pp',
			this.scanCodeOutPath,
			this.dirtyRoot,
		]
		await $`${cmd}`
	}
}
