import t from 'tap'
import { $ } from 'zx'

import { LocalDatabase } from './db.js'
import { ScanStep5 } from './scan-step-5.js'
import { createTestConfig, testLogger } from './test-utils.js'
import type { AnalysedFile } from './types.js'

t.test('audit', async (t) => {
	const testConf = await createTestConfig(t.fullname)
	const logger = testLogger()
	$.verbose = false

	const db = new LocalDatabase({
		sqlitePath: testConf.dbPath,
		logger,
	})
	db.allowedLicenses = ['ruby', 'mit', 'bsd-new']

	const dbFiles: AnalysedFile[] = [
		{
			filePath: 'a1/with-ruby.txt',
			contentText: `
				Ruby License
			`,
			licenses: ['ruby'],
		},
		{
			filePath: 'a1/with-gpl.txt',
			contentText: `
				GPL License // line 2
				MIT License // line 3
			`,
			licenses: ['gpl-1.0', 'mit'],
			scanCodeEntry: {
				path: '',
				sha256: '',
				type: '',
				license_detections: [
					{
						matches: [
							{
								license_expression: 'gpl-1.0',
								matched_text: 'GPL License // line 2',
							},
							{
								license_expression: 'mit',
								matched_text: 'MIT License // line 3',
							},
						],
					},
				],
			},
		},
		{
			filePath: 'a1/permissive-only.txt',
			contentText: `
				MIT
				BSD
			`,
			licenses: ['mit', 'bsd-new'],
		},
		{
			filePath: 'a2/nonsense.txt',
			contentText: `
				Hello
			`,
		},
	]
	prepareDbFiles(db, dbFiles)

	const step = new ScanStep5({
		db,
		logger,
		scanCodeBinary: testConf.scanCodeBinary,
		auditOutPath: testConf.auditOutPath,
		verbose: true,
		print: false,
	})
	const auditTree = await step.run()

	const countFindings = auditTree.countLeaves()
	t.match(countFindings, 1)

	const scanCodeEntry = auditTree.root['a1']['with-gpl.txt'].scanCodeEntry

	const gplFinding = scanCodeEntry.license_detections[0].matches[0]
	t.match(gplFinding.matched_text, 'GPL License // line 2')

	const mitFinding = scanCodeEntry.license_detections[0].matches[1]
	t.match(mitFinding.matched_text, 'MIT License // line 3')
})

function prepareDbFiles(db: LocalDatabase, files: AnalysedFile[]) {
	for (const file of files) {
		db.upsertFile(file, false)
	}
}
