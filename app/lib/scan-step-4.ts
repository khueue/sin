import chalk from 'chalk';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import type { LocalDatabase } from './db';
import type {
	AnalysedFile,
	BasicLogger,
	LicenseInfo,
	ScanCodeEntry,
} from './types';

const SHA256_EMPTY_STRING =
	'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

interface Config {
	db: LocalDatabase;
	dirtyRoot: string;
	logger: BasicLogger;
	scanCodeOutPath: string;
}

export class ScanStep4 {
	db: LocalDatabase;
	previouslyAnalysedFiles: Record<string, AnalysedFile> = {};
	dirtyRoot: string;
	logger: BasicLogger;
	scanCodeOutPath: string;

	constructor(config: Config) {
		this.db = config.db;
		this.dirtyRoot = config.dirtyRoot;
		this.logger = config.logger;
		this.scanCodeOutPath = config.scanCodeOutPath;
	}

	async run() {
		this.logger.info(chalk`{yellow === STEP 4: Save results to database}`);

		if (!existsSync(this.scanCodeOutPath)) {
			this.logger.info(`Nothing to be done (no ScanCode report found).`);
			return;
		}
		if (!existsSync(this.dirtyRoot)) {
			this.logger.info(`Nothing to be done (no dirty files).`);
			return;
		}

		this.logger.info(`Loading all previously analysed files from database ...`);
		this.previouslyAnalysedFiles = this.db.fetchAllAnalysedFiles();
		const count = Object.keys(this.previouslyAnalysedFiles).length;
		this.logger.info(`  done (loaded ${count}).`);

		let numSavedFiles = 0;

		this.logger.info(`Saving results of ScanCode report to database ...`);
		const reportContents = await readFile(this.scanCodeOutPath, 'utf-8');
		const reportJson = JSON.parse(reportContents);
		for (const scanCodeEntry of reportJson.files) {
			const scannedFile = scanCodeEntry as ScanCodeEntry;
			if (scannedFile.type === 'directory') {
				continue;
			}

			const file = {
				filePath: scannedFile.path,
				contentSha256: scannedFile.sha256 ?? SHA256_EMPTY_STRING,
			} as AnalysedFile;

			if (scannedFile.licenses.length) {
				// Gather and de-duplicate license findings.
				const licensesMap: Record<string, LicenseInfo> = {};
				for (const foundLicense of scannedFile.licenses) {
					if (!licensesMap[foundLicense.name]) {
						// Extract subset of details.
						licensesMap[foundLicense.name] = {
							name: foundLicense.name,
							category: foundLicense.category,
						};
					}
				}
				const licenses = Object.values(licensesMap);
				if (licenses.length) {
					file.licenses = licenses;

					// Save file contents only if we have license findings.
					const contentText = await readFile(
						`${this.dirtyRoot}/${file.filePath}`,
						'utf-8',
					);
					file.contentText = contentText;
				}

				file.isLegalDocument = Boolean(scannedFile.is_legal);
			}

			const exists = Boolean(this.previouslyAnalysedFiles[file.filePath]);
			this.db.upsertFile(file, exists);
			++numSavedFiles;
		}
		this.logger.info(`  done (saved ${numSavedFiles}).`);
	}
}
