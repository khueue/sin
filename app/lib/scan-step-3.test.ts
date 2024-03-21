import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import t from 'tap'
import { $ } from 'zx'

import { ScanStep3 } from './scan-step-3.js'
import type { FileStub } from './test-utils.js'
import {
	createTestConfig,
	prepareDirtyFiles,
	testLogger,
} from './test-utils.js'
import type { ScanCodeEntry } from './types.js'

t.test('scan dirty files', async (t) => {
	const testConf = await createTestConfig(t.fullname)
	const logger = testLogger()
	$.verbose = false

	const initialDirtyFiles: FileStub[] = [
		{
			filePath: 'a1/with-gpl.txt',
			shouldHaveLicenseFindings: true,
			contents: `
				MIT
				GPL
			`,
		},
		{
			filePath: 'a1/permissive-only.txt',
			shouldHaveLicenseFindings: true,
			contents: `
				MIT
				BSD
			`,
		},
		{
			filePath: 'a2/nonsense.txt',
			contents: `
				Hello
			`,
		},
	]
	await prepareDirtyFiles(testConf, initialDirtyFiles)

	const step = new ScanStep3({
		logger,
		dirtyRoot: testConf.dirtyRoot,
		scanCodeBinary: testConf.scanCodeBinary,
		scanCodeOutPath: testConf.scanCodeOutPath,
		verbose: true,
	})
	await step.run()

	t.match(existsSync(testConf.scanCodeOutPath), true)

	const reportContents = await readFile(testConf.scanCodeOutPath, 'utf-8')
	const scannedFiles: ScanCodeEntry[] = JSON.parse(reportContents).files
	for (const dirtyFile of initialDirtyFiles) {
		const scanEntry = getScanCodeEntry(scannedFiles, dirtyFile.filePath)
		const numLicenseFindings = scanEntry.license_detections?.length
		if (dirtyFile.shouldHaveLicenseFindings) {
			t.ok(numLicenseFindings)
		} else {
			t.notOk(numLicenseFindings)
		}
	}
})

function getScanCodeEntry(
	scanCodeFileEntries: ScanCodeEntry[],
	relPath: string,
) {
	for (const entry of scanCodeFileEntries) {
		if (entry.path === relPath) {
			return entry
		}
	}
	throw new Error(`Could not find ScanCode entry for: ${relPath}`)
}
