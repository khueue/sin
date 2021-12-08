import { LocalDatabase } from './db'
import { ScanStep4 } from './scan-step-4'
import {
	createTestConfig,
	FileStub,
	prepareDirtyFiles,
	testLogger,
	writeFileForce,
} from './test-utils'
import type { AnalysedFileRow, ScanCodeEntry } from './types'

test('save to db, some old', async () => {
	const testConf = await createTestConfig()
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
		content_text: someFile.contents,
		licenses: '{"old":"licenses"}',
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
		})
		const dirtyFile = findDirtyFile(dirtyFiles, reportEntry.path)
		// Should be in database with correct hash.
		expect(row.content_sha256 === reportEntry.sha256).toBeTruthy()
		// Should move current reason to previous if it was already in db.
		if (dirtyFile.inDb) {
			expect(row.previous_accepted_reason).toBe('old_current_accepted_reason')
		}
		// Should have cleared out current reason.
		expect(row.current_accepted_reason).toBeFalsy()
		expect(row.current_accepted_at).toBeFalsy()
		// Should save file contents along with licenses.
		if (dirtyFile.shouldHaveLicenseFindings) {
			expect(row.licenses).toBeTruthy()
			expect(row.content_text).toBe(dirtyFile.contents)
		} else {
			expect(row.licenses).toBeFalsy()
			expect(row.content_text).toBeFalsy()
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
				licenses: [],
				license_expressions: [],
				percentage_of_license_text: 0,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: true,
				is_key_file: false,
				files_count: 2,
				dirs_count: 0,
				size_count: 40,
				scan_errors: [],
			},
			{
				path: 'a1/permissive-only.txt',
				type: 'file',
				name: 'permissive-only.txt',
				base_name: 'permissive-only',
				extension: '.txt',
				size: 20,
				date: '2021-12-01',
				sha1: '4dd8b3f4e334323adbe26f57f88b0817506c931c',
				md5: 'ff4df1f78f8e2465abf8e25ebb1564f9',
				sha256:
					'c4b3b70b3a20e2855668ab9e4d76092b93a41391de03d94a7e02952b28e532dd',
				mime_type: 'text/plain',
				file_type: 'ASCII text',
				programming_language: null,
				is_binary: false,
				is_text: true,
				is_archive: false,
				is_media: false,
				is_source: false,
				is_script: false,
				licenses: [
					{
						key: 'mit',
						score: 80.0,
						name: 'MIT License',
						short_name: 'MIT License',
						category: 'Permissive',
						is_exception: false,
						is_unknown: false,
						owner: 'MIT',
						homepage_url: 'http://opensource.org/licenses/mit-license.php',
						text_url: 'http://opensource.org/licenses/mit-license.php',
						reference_url: 'https://scancode-licensedb.aboutcode.org/mit',
						scancode_text_url:
							'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/licenses/mit.LICENSE',
						scancode_data_url:
							'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/licenses/mit.yml',
						spdx_license_key: 'MIT',
						spdx_url: 'https://spdx.org/licenses/MIT',
						start_line: 2,
						end_line: 3,
						matched_rule: {
							identifier: 'mit_and_bsd-new_modernizr_2.RULE',
							license_expression: 'mit AND bsd-new',
							licenses: ['mit', 'bsd-new'],
							referenced_filenames: [],
							is_license_text: false,
							is_license_notice: false,
							is_license_reference: true,
							is_license_tag: false,
							is_license_intro: false,
							has_unknown: false,
							matcher: '1-hash',
							rule_length: 2,
							matched_length: 2,
							match_coverage: 100.0,
							rule_relevance: 80,
						},
					},
					{
						key: 'bsd-new',
						score: 80.0,
						name: 'BSD-3-Clause',
						short_name: 'BSD-3-Clause',
						category: 'Permissive',
						is_exception: false,
						is_unknown: false,
						owner: 'Regents of the University of California',
						homepage_url: 'http://www.opensource.org/licenses/BSD-3-Clause',
						text_url: 'http://www.opensource.org/licenses/BSD-3-Clause',
						reference_url: 'https://scancode-licensedb.aboutcode.org/bsd-new',
						scancode_text_url:
							'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/licenses/bsd-new.LICENSE',
						scancode_data_url:
							'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/licenses/bsd-new.yml',
						spdx_license_key: 'BSD-3-Clause',
						spdx_url: 'https://spdx.org/licenses/BSD-3-Clause',
						start_line: 2,
						end_line: 3,
						matched_rule: {
							identifier: 'mit_and_bsd-new_modernizr_2.RULE',
							license_expression: 'mit AND bsd-new',
							licenses: ['mit', 'bsd-new'],
							referenced_filenames: [],
							is_license_text: false,
							is_license_notice: false,
							is_license_reference: true,
							is_license_tag: false,
							is_license_intro: false,
							has_unknown: false,
							matcher: '1-hash',
							rule_length: 2,
							matched_length: 2,
							match_coverage: 100.0,
							rule_relevance: 80,
						},
					},
				],
				license_expressions: ['mit AND bsd-new'],
				percentage_of_license_text: 100.0,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: false,
				is_key_file: false,
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
				size: 20,
				date: '2021-12-01',
				sha1: '606e6a7452a061796e2765060d0fd1d64f75a708',
				md5: '0b5d8fb8ec129b71ca1f658e13b10bf5',
				sha256:
					'03804edc6a20ae168c959da164b67dbbbbee8eb15404b15c0be47aff9fe32909',
				mime_type: 'text/plain',
				file_type: 'ASCII text',
				programming_language: null,
				is_binary: false,
				is_text: true,
				is_archive: false,
				is_media: false,
				is_source: false,
				is_script: false,
				licenses: [
					{
						key: 'mit',
						score: 100.0,
						name: 'MIT License',
						short_name: 'MIT License',
						category: 'Permissive',
						is_exception: false,
						is_unknown: false,
						owner: 'MIT',
						homepage_url: 'http://opensource.org/licenses/mit-license.php',
						text_url: 'http://opensource.org/licenses/mit-license.php',
						reference_url: 'https://scancode-licensedb.aboutcode.org/mit',
						scancode_text_url:
							'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/licenses/mit.LICENSE',
						scancode_data_url:
							'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/licenses/mit.yml',
						spdx_license_key: 'MIT',
						spdx_url: 'https://spdx.org/licenses/MIT',
						start_line: 2,
						end_line: 3,
						matched_rule: {
							identifier: 'mit_or_gpl_3.RULE',
							license_expression: 'mit OR gpl-1.0-plus',
							licenses: ['mit', 'gpl-1.0-plus'],
							referenced_filenames: [],
							is_license_text: false,
							is_license_notice: true,
							is_license_reference: false,
							is_license_tag: false,
							is_license_intro: false,
							has_unknown: false,
							matcher: '1-hash',
							rule_length: 2,
							matched_length: 2,
							match_coverage: 100.0,
							rule_relevance: 100,
						},
					},
					{
						key: 'gpl-1.0-plus',
						score: 100.0,
						name: 'GNU General Public License 1.0 or later',
						short_name: 'GPL 1.0 or later',
						category: 'Copyleft',
						is_exception: false,
						is_unknown: false,
						owner: 'Free Software Foundation (FSF)',
						homepage_url:
							'http://www.gnu.org/licenses/old-licenses/gpl-1.0-standalone.html',
						text_url:
							'http://www.gnu.org/licenses/old-licenses/gpl-1.0-standalone.html',
						reference_url:
							'https://scancode-licensedb.aboutcode.org/gpl-1.0-plus',
						scancode_text_url:
							'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/licenses/gpl-1.0-plus.LICENSE',
						scancode_data_url:
							'https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/licenses/gpl-1.0-plus.yml',
						spdx_license_key: 'GPL-1.0-or-later',
						spdx_url: 'https://spdx.org/licenses/GPL-1.0-or-later',
						start_line: 2,
						end_line: 3,
						matched_rule: {
							identifier: 'mit_or_gpl_3.RULE',
							license_expression: 'mit OR gpl-1.0-plus',
							licenses: ['mit', 'gpl-1.0-plus'],
							referenced_filenames: [],
							is_license_text: false,
							is_license_notice: true,
							is_license_reference: false,
							is_license_tag: false,
							is_license_intro: false,
							has_unknown: false,
							matcher: '1-hash',
							rule_length: 2,
							matched_length: 2,
							match_coverage: 100.0,
							rule_relevance: 100,
						},
					},
				],
				license_expressions: ['mit OR gpl-1.0-plus'],
				percentage_of_license_text: 100.0,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: false,
				is_key_file: false,
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
				licenses: [],
				license_expressions: [],
				percentage_of_license_text: 0,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: true,
				is_key_file: false,
				files_count: 1,
				dirs_count: 0,
				size_count: 14,
				scan_errors: [],
			},
			{
				path: 'a2/nonsense.txt',
				type: 'file',
				name: 'nonsense.txt',
				base_name: 'nonsense',
				extension: '.txt',
				size: 14,
				date: '2021-12-01',
				sha1: '1937d0a741146c4ee39befcc2ea7e0294d22f7a4',
				md5: 'e4c7a7cdac6799e5f66b1fbc8fb9ad0b',
				sha256:
					'61e9c221e684a03a51589cf94dcd39f12d9180dfa03a959855be82e70683f25f',
				mime_type: 'text/plain',
				file_type: 'ASCII text',
				programming_language: null,
				is_binary: false,
				is_text: true,
				is_archive: false,
				is_media: false,
				is_source: false,
				is_script: false,
				licenses: [],
				license_expressions: [],
				percentage_of_license_text: 0,
				is_legal: false,
				is_manifest: false,
				is_readme: false,
				is_top_level: false,
				is_key_file: false,
				files_count: 0,
				dirs_count: 0,
				size_count: 0,
				scan_errors: [],
			},
		],
	}
}
