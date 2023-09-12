export interface LicenseInfo {
	license_expression: string
	// name: string
	// category: string
}

export interface AnalysedFile {
	filePath: string
	contentSha256?: string
	contentText?: string
	previousAcceptedReason?: string
	currentAcceptedReason?: string
	currentAcceptedAt?: Date
	isLegalDocument?: boolean
	licenses?: LicenseInfo[]
	dirty?: boolean // Used to determine if file is new/modified.
}

export interface AnalysedFileRow {
	file_path: string
	content_sha256?: string
	content_text?: string
	previous_accepted_reason?: string
	current_accepted_reason?: string
	current_accepted_at?: string // Date as string.
	is_legal_document?: number // Boolean as 1 or 0.
	licenses?: string // LicenseInfo[] as stringified JSON.
}

// Subset of what ScanCode generates for each file.
export interface ScanCodeEntry {
	path: string // File path.
	type: string // File type.
	sha256: string // SHA256 of content.
	detected_license_expression: string | null
	license_detections: LicenseInfo[] // License detections.
	is_legal?: boolean // Considered a legal document (e.g. license file).
}

// {
// 	"path": "node_modules/@ampproject/remapping/package.json",
// 	"type": "file",
// 	"name": "package.json",
// 	"base_name": "package",
// 	"extension": ".json",
// 	"size": 2232,
// 	"date": "2023-09-11",
// 	"sha1": "d9f21374f95f9a9ce83559f87f17dfa3a0ccc02f",
// 	"md5": "71e250cc52f27ac4c04ab177b915332d",
// 	"sha256": "b416e881e5f362cc877b39b75e7cc5ee4996c8d28602dc1912a6ef4214fa6aeb",
// 	"mime_type": "application/json",
// 	"file_type": "JSON text data",
// 	"programming_language": null,
// 	"is_binary": false,
// 	"is_text": true,
// 	"is_archive": false,
// 	"is_media": false,
// 	"is_source": false,
// 	"is_script": false,
// 	"is_legal": false,
// 	"is_manifest": true,
// 	"is_readme": false,
// 	"is_top_level": false,
// 	"is_key_file": false,
// 	"detected_license_expression": "apache-2.0",
// 	"detected_license_expression_spdx": "Apache-2.0",
// 	"license_detections": [
// 		{
// 			"license_expression": "apache-2.0",
// 			"matches": [
// 				{
// 					"score": 100.0,
// 					"start_line": 33,
// 					"end_line": 33,
// 					"matched_length": 4,
// 					"match_coverage": 100.0,
// 					"matcher": "2-aho",
// 					"license_expression": "apache-2.0",
// 					"rule_identifier": "apache-2.0_65.RULE",
// 					"rule_relevance": 100,
// 					"rule_url": "https://github.com/nexB/scancode-toolkit/tree/develop/src/licensedcode/data/rules/apache-2.0_65.RULE"
// 				}
// 			],
// 			"identifier": "apache_2_0-ec759ae0-ea5a-f138-793e-388520e080c0"
// 		}
// 	],
// 	"license_clues": [],
// 	"percentage_of_license_text": 1.43,
// 	"files_count": 0,
// 	"dirs_count": 0,
// 	"size_count": 0,
// 	"scan_errors": []
// }

export interface BasicLogger {
	info(...x: any[]): void
	error(...x: any[]): void
	time(label?: string): void
	timeEnd(label?: string): void
}
