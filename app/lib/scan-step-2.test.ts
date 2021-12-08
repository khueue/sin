import { $, globby } from 'zx'
import { ScanStep2 } from './scan-step-2'
import type { FileStub } from './test-utils'
import { createTestConfig, prepareDirtyFiles, testLogger } from './test-utils'

// Allow extractcode to take some time.
jest.setTimeout(10_000)

test('extract archives', async () => {
	const testConf = await createTestConfig()
	const logger = testLogger()
	$.verbose = false

	const initialDirtyFiles: FileStub[] = [
		{
			filePath: 'a1/with-gpl.txt',
			contents: `
				GPL
			`,
		},
		{
			filePath: 'a1/permissive-only.txt',
			contents: `
				MIT
				BSD
			`,
		},
	]
	await prepareDirtyFiles(testConf, initialDirtyFiles)

	// Add one (1) compressed file.
	const someFile = testConf.dirtyRoot + '/' + initialDirtyFiles[0].filePath
	await $`cp ${someFile} ${someFile}.copy`
	await $`gzip ${someFile}.copy`

	// Running the step should add yet one (1) more file (uncompressed).
	const step = new ScanStep2({
		logger,
		dirtyRoot: testConf.dirtyRoot,
		verbose: true,
	})
	await step.run()

	const finalDirtyFiles = await globby(`${testConf.dirtyRoot}/**`)
	expect(finalDirtyFiles.length).toBe(4)
})
