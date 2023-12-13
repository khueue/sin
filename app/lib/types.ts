export interface AnalysedFile {
	filePath: string
	contentSha256?: string
	contentText?: string
	previousAcceptedReason?: string
	currentAcceptedReason?: string
	currentAcceptedAt?: Date
	isLegalDocument?: boolean
	licenses?: string[]
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
	licenses?: string // Licenses as stringified JSON list.
}

// Subset of what ScanCode generates for each file.
export interface ScanCodeEntry {
	path: string // File path.
	type: string // File type.
	sha256: string // SHA256 of content.
	is_legal?: boolean // Considered a legal document (e.g. license file).
	license_detections: {
		matches: {
			license_expression: string
		}[]
	}[]
}

export interface BasicLogger {
	info(...x: any[]): void
	error(...x: any[]): void
	time(label?: string): void
	timeEnd(label?: string): void
}
