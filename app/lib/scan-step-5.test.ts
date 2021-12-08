import { $ } from 'zx';
import { LocalDatabase } from './db';
import { ScanStep5 } from './scan-step-5';
import { createTestConfig, testLogger } from './test-utils';
import type { AnalysedFile } from './types';

test('audit', async () => {
	const testConf = await createTestConfig();
	const logger = testLogger();
	$.verbose = false;

	const db = new LocalDatabase({
		sqlitePath: testConf.dbPath,
		logger,
	});
	db.allowedSpecificLicenses = ['Ruby License'];
	db.allowedLicenseCategories = ['Permissive'];

	const dbFiles: AnalysedFile[] = [
		{
			filePath: 'a1/with-ruby.txt',
			contentText: `
				Ruby License
			`,
			licenses: [
				{
					name: 'Ruby License',
					category: '',
				},
			],
		},
		{
			filePath: 'a1/with-gpl.txt',
			contentText: `
				GPL License // line 2
				MIT License // line 3
			`,
			licenses: [
				{
					name: 'GPL',
					category: 'Copyleft',
				},
				{
					name: 'MIT',
					category: 'Permissive',
				},
			],
		},
		{
			filePath: 'a1/permissive-only.txt',
			contentText: `
				MIT
				BSD
			`,
			licenses: [
				{
					name: 'MIT',
					category: 'Permissive',
				},
				{
					name: 'BSD',
					category: 'Permissive',
				},
			],
		},
		{
			filePath: 'a2/nonsense.txt',
			contentText: `
				Hello
			`,
		},
	];
	prepareDbFiles(db, dbFiles);

	const step = new ScanStep5({
		db,
		logger,
		auditOutPath: testConf.auditOutPath,
		verbose: true,
	});
	const auditTree = await step.run();

	const countFindings = auditTree.countLeaves();
	expect(countFindings).toBe(1);

	const detailedReport = auditTree.root['a1']['with-gpl.txt'].scanCodeReport;

	const gplFinding = detailedReport.licenses[0];
	expect(gplFinding.matched_text).toContain('GPL License // line 2');

	const mitFinding = detailedReport.licenses[1];
	expect(mitFinding.matched_text).toContain('MIT License // line 3');
});

function prepareDbFiles(db: LocalDatabase, files: AnalysedFile[]) {
	for (const file of files) {
		db.upsertFile(file, false);
	}
}
