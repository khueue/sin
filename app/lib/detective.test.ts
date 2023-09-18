import { Detective } from './detective'
import type { AnalysedFile } from './types'

test('innocent files', async () => {
	const detective = new Detective(['ruby'], [])

	let file: AnalysedFile
	let suspicious: boolean

	file = {
		filePath: 'some/file.txt',
	}
	suspicious = detective.fileNeedsInvestigation(file)
	expect(suspicious).toBeFalsy()

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
	expect(suspicious).toBeFalsy()

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
	expect(suspicious).toBeFalsy()
})

test('suspicious files', async () => {
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
	expect(suspicious).toBeTruthy()
})
