import t from 'tap'

import { Detective } from './detective.js'
import type { AnalysedFile } from './types.js'

t.test('innocent files', async (t) => {
	const detective = new Detective(['ruby'], [])

	let file: AnalysedFile
	let suspicious: boolean

	file = {
		filePath: 'some/file.txt',
	}
	suspicious = detective.fileNeedsInvestigation(file)
	t.notOk(suspicious)

	file = {
		filePath: 'some/file.txt',
		licenses: [
			{
				license_expression: 'ruby',
			},
			// {
			// 	name: '',
			// },
		],
	}
	suspicious = detective.fileNeedsInvestigation(file)
	t.notOk(suspicious)

	file = {
		filePath: 'some/file.txt',
		licenses: [
			{
				license_expression: 'gpl-1.0',
			},
		],
		currentAcceptedAt: new Date(),
	}
	suspicious = detective.fileNeedsInvestigation(file)
	t.notOk(suspicious)
})

t.test('suspicious files', async (t) => {
	const detective = new Detective(['ruby'], [])

	let file: AnalysedFile
	let suspicious: boolean

	file = {
		filePath: 'some/file.txt',
		licenses: [
			{
				license_expression: 'What Is This License',
			},
		],
	}
	suspicious = detective.fileNeedsInvestigation(file)
	t.ok(suspicious)
})
