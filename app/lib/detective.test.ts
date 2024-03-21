import t from 'tap'

import { Detective } from './detective.js'
import type { AnalysedFile } from './types.js'

t.test('innocent files', async (t) => {
	const detective = new Detective(['mit', 'bsd-new'])

	let file: AnalysedFile
	let suspicious: boolean

	file = {
		filePath: 'some/file.txt',
	}
	suspicious = detective.fileNeedsInvestigation(file)
	t.match(suspicious, false)

	file = {
		filePath: 'some/file.txt',
		licenses: ['bsd-new'],
	}
	suspicious = detective.fileNeedsInvestigation(file)
	t.match(suspicious, false)

	file = {
		filePath: 'some/file.txt',
		licenses: ['bsd-new', 'mit'],
	}
	suspicious = detective.fileNeedsInvestigation(file)
	t.match(suspicious, false)
})

t.test('suspicious files', async (t) => {
	const detective = new Detective(['mit', 'bsd-new'])

	let file: AnalysedFile
	let suspicious: boolean

	file = {
		filePath: 'some/file.txt',
		licenses: ['mit', 'gpl-1.0-plus'],
	}
	suspicious = detective.fileNeedsInvestigation(file)
	t.match(suspicious, true)
})
