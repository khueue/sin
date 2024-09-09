import t from 'tap'

import { LocalDatabase } from './db.js'
import { ScanStep4 } from './scan-step-4.js'
import {
	createTestConfig,
	FileStub,
	prepareDirtyFiles,
	testLogger,
	writeFileForce,
} from './test-utils.js'
import type { AnalysedFileRow, ScanCodeEntry } from './types.js'

t.test('save to db, some old', async (t) => {
	const testConf = await createTestConfig(t.fullname)
	const logger = testLogger()

	const db = new LocalDatabase({
		sqlitePath: testConf.dbPath,
		logger,
	})

	const dirtyFiles: FileStub[] = [
		{
			filePath: 'a1/with-gpl.txt',
			shouldHaveLicenseFindings: true,
			inDb: true,
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
	await prepareDirtyFiles(testConf, dirtyFiles)

	const someFile = dirtyFiles[0]
	db.stmtInsertFile.run({
		file_path: someFile.filePath,
		content_sha256: 'old_content_sha256',
		content_text: null,
		scancode_entry: null,
		licenses: JSON.stringify(['old1', 'old2']),
		previous_accepted_reason: 'old_previous_accepted_reason',
		current_accepted_reason: 'old_current_accepted_reason',
		current_accepted_at: 'old_current_accepted_at',
		is_legal_document: 0,
	})

	const scanCodeReport = getScanCodeReport()
	await writeFileForce(testConf.scanCodeOutPath, JSON.stringify(scanCodeReport))

	const step = new ScanStep4({
		db,
		logger,
		dirtyRoot: testConf.dirtyRoot,
		scanCodeOutPath: testConf.scanCodeOutPath,
	})
	await step.run()

	const stmt = db.sqlite.prepare(`
		SELECT *
		FROM analysed_files
		WHERE file_path = :file_path
	`)
	const scannedFiles = scanCodeReport.files as ScanCodeEntry[]
	for (const reportEntry of scannedFiles) {
		if (reportEntry.type === 'directory') {
			continue
		}
		const row: AnalysedFileRow = stmt.get({
			file_path: reportEntry.path,
		}) as any
		const dirtyFile = findDirtyFile(dirtyFiles, reportEntry.path)
		// Should be in database with correct hash.
		t.match(row.content_sha256, reportEntry.sha256)
		// Should move current reason to previous if it was already in db.
		if (dirtyFile.inDb) {
			t.match(row.previous_accepted_reason, 'old_current_accepted_reason')
		}
		// Should have cleared out current reason.
		t.notOk(row.current_accepted_reason)
		t.notOk(row.current_accepted_at)
		// Should save file contents along with licenses.
		if (dirtyFile.shouldHaveLicenseFindings) {
			t.ok(row.licenses)
			// t.match(row.content_text, dirtyFile.contents)
		} else {
			t.notOk(row.licenses)
			// t.notOk(row.content_text)
		}
	}
})

function findDirtyFile(dirtyFiles: FileStub[], relPath: string) {
	for (const file of dirtyFiles) {
		if (file.filePath === relPath) {
			return file
		}
	}
	throw new Error(
		`Could not correlate ScanCode entry to dirty file: ${relPath}`,
	)
}

function getScanCodeReport() {
	return {
		headers: [
			// Irrelevant.
		],
		license_detections: [
			// Irrelevant.
		],
		files: [
			{
				path: 'a1',
				type: 'directory',
				name: 'a1',
				base_name: 'a1',
				extension: '',
				size: 0,
				date: null,
				sha1: null,
				md5: null,
				sha256: null,
				mime_type: null,
				file_type: null,
				programming_language: null,
				is_binary: false,
				is_text: false,
				is_archive: false,
				is_media: false,
				is_source: false,
				is_script: false,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: true,
				is_key_file: false,
				detected_license_expression: null,
				detected_license_expression_spdx: null,
				license_detections: [],
				license_clues: [],
				percentage_of_license_text: 0,
				files_count: 2,
				dirs_count: 0,
				size_count: 16,
				scan_errors: [],
			},
			{
				path: 'a1/permissive-only.txt',
				type: 'file',
				name: 'permissive-only.txt',
				base_name: 'permissive-only',
				extension: '.txt',
				size: 8,
				date: '2023-09-18',
				sha1: '9f829bbce4de72431815f6cf7d10ddb8b0a48890',
				md5: '8251c1e8ca1b3dc85a069dc8236cf02a',
				sha256:
					'03541d2941b8f44ae55f7d49482571fa8ed58ec2fa43a39d81d23cc64714a498',
				mime_type: 'text/plain',
				file_type: 'ASCII text',
				programming_language: null,
				is_binary: false,
				is_text: true,
				is_archive: false,
				is_media: false,
				is_source: false,
				is_script: false,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: false,
				is_key_file: false,
				detected_license_expression: 'mit AND bsd-new',
				detected_license_expression_spdx: 'MIT AND BSD-3-Clause',
				license_detections: [
					{
						license_expression: 'mit AND bsd-new',
						matches: [
							{
								score: 80.0,
								start_line: 1,
								end_line: 2,
								matched_length: 2,
								match_coverage: 100.0,
								matcher: '1-hash',
								license_expression: 'mit AND bsd-new',
								rule_identifier: 'mit_and_bsd-new_modernizr_2.RULE',
								rule_relevance: 80,
								rule_url:
									'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/rules/mit_and_bsd-new_modernizr_2.RULE',
							},
						],
						identifier: 'mit_and_bsd_new-7e525c88-20f7-e1cc-dcb9-397e745f5a76',
					},
				],
				license_clues: [],
				percentage_of_license_text: 100.0,
				files_count: 0,
				dirs_count: 0,
				size_count: 0,
				scan_errors: [],
			},
			{
				path: 'a1/with-gpl.txt',
				type: 'file',
				name: 'with-gpl.txt',
				base_name: 'with-gpl',
				extension: '.txt',
				size: 8,
				date: '2023-09-18',
				sha1: '54adcb1f3d30e3e1ce7a63775557faae40ede3fe',
				md5: '0c7e7785b271deaa1fbf92fd433d77a0',
				sha256:
					'1335147917311fe87060759f1205f0d90887ee9e8d6d756be8d4527a58b88370',
				mime_type: 'text/plain',
				file_type: 'ASCII text',
				programming_language: null,
				is_binary: false,
				is_text: true,
				is_archive: false,
				is_media: false,
				is_source: false,
				is_script: false,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: false,
				is_key_file: false,
				detected_license_expression: 'mit OR gpl-1.0-plus',
				detected_license_expression_spdx: 'MIT OR GPL-1.0-or-later',
				license_detections: [
					{
						license_expression: 'mit OR gpl-1.0-plus',
						matches: [
							{
								score: 100.0,
								start_line: 1,
								end_line: 2,
								matched_length: 2,
								match_coverage: 100.0,
								matcher: '1-hash',
								license_expression: 'mit OR gpl-1.0-plus',
								rule_identifier: 'mit_or_gpl_3.RULE',
								rule_relevance: 100,
								rule_url:
									'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/rules/mit_or_gpl_3.RULE',
							},
						],
						identifier:
							'mit_or_gpl_1_0_plus-d28d8fcb-e415-ea23-833c-58a65b42d70b',
					},
				],
				license_clues: [],
				percentage_of_license_text: 100.0,
				files_count: 0,
				dirs_count: 0,
				size_count: 0,
				scan_errors: [],
			},
			{
				path: 'a2',
				type: 'directory',
				name: 'a2',
				base_name: 'a2',
				extension: '',
				size: 0,
				date: null,
				sha1: null,
				md5: null,
				sha256: null,
				mime_type: null,
				file_type: null,
				programming_language: null,
				is_binary: false,
				is_text: false,
				is_archive: false,
				is_media: false,
				is_source: false,
				is_script: false,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: true,
				is_key_file: false,
				detected_license_expression: null,
				detected_license_expression_spdx: null,
				license_detections: [],
				license_clues: [],
				percentage_of_license_text: 0,
				files_count: 1,
				dirs_count: 0,
				size_count: 9,
				scan_errors: [],
			},
			{
				path: 'a2/nonsense.txt',
				type: 'file',
				name: 'nonsense.txt',
				base_name: 'nonsense',
				extension: '.txt',
				size: 9,
				date: '2023-09-18',
				sha1: '7dd4c0df649c75ceb1a44b42f79fd6c7c40540c2',
				md5: '0377438312a93cf85307e3fa0fe437cf',
				sha256:
					'2f9d23efc183016965f402b0ca2bfc1edb5830759a169288d8bc19dd99abe9c5',
				mime_type: 'text/plain',
				file_type: 'ASCII text',
				programming_language: null,
				is_binary: false,
				is_text: true,
				is_archive: false,
				is_media: false,
				is_source: false,
				is_script: false,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: false,
				is_key_file: false,
				detected_license_expression: null,
				detected_license_expression_spdx: null,
				license_detections: [],
				license_clues: [],
				percentage_of_license_text: 0,
				files_count: 0,
				dirs_count: 0,
				size_count: 0,
				scan_errors: [],
			},
		],
	}
}
