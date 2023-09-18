import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { $ } from 'zx'
import { ScanStep3 } from './scan-step-3'
import type { FileStub } from './test-utils'
import { createTestConfig, prepareDirtyFiles, testLogger } from './test-utils'
import type { ScanCodeEntry } from './types'

// Allow scancode to take some time.
jest.setTimeout(30_000)

test('scan dirty files', async () => {
	const testConf = await createTestConfig()
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
		scanCodeOutPath: testConf.scanCodeOutPath,
		verbose: true,
	})
	await step.run()

	expect(existsSync(testConf.scanCodeOutPath)).toBeTruthy()

	const reportContents = await readFile(testConf.scanCodeOutPath, 'utf-8')
	const scannedFiles: ScanCodeEntry[] = JSON.parse(reportContents).files
	for (const dirtyFile of initialDirtyFiles) {
		const scanEntry = getScanCodeEntry(scannedFiles, dirtyFile.filePath)
		const numLicenseFindings = scanEntry.license_detections.length
		if (dirtyFile.shouldHaveLicenseFindings) {
			expect(numLicenseFindings).toBeTruthy()
		} else {
			expect(numLicenseFindings).toBeFalsy()
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
