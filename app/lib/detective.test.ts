import { Detective } from './detective'
import type { AnalysedFile } from './types'

test('innocent files', async () => {
	const detective = new Detective(['Ruby License'], ['Permissive'])

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
				name: 'Ruby License',
				category: '',
			},
			{
				name: '',
				category: 'Permissive',
			},
		],
	}
	suspicious = detective.fileNeedsInvestigation(file)
	expect(suspicious).toBeFalsy()

	file = {
		filePath: 'some/file.txt',
		licenses: [
			{
				name: 'GPL',
				category: '',
			},
		],
		currentAcceptedAt: new Date(),
	}
	suspicious = detective.fileNeedsInvestigation(file)
	expect(suspicious).toBeFalsy()
})

test('suspicious files', async () => {
	const detective = new Detective(['Ruby License'], ['Permissive'])

	let file: AnalysedFile
	let suspicious: boolean

	file = {
		filePath: 'some/file.txt',
		licenses: [
			{
				name: 'What Is This License',
				category: '',
			},
			{
				name: '',
				category: 'Permissive',
			},
		],
	}
	suspicious = detective.fileNeedsInvestigation(file)
	expect(suspicious).toBeTruthy()
})
