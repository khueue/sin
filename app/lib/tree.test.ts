import t from 'tap'

import { Detective } from './detective.js'
import { FileTree } from './tree.js'
import type { AnalysedFile } from './types.js'

t.test('empty tree', async (t) => {
	const files: AnalysedFile[] = []
	const detective = new Detective([])
	const tree = new FileTree(files, detective)

	t.match(tree.root, {})
})

t.test('non-empty tree', async (t) => {
	const files: AnalysedFile[] = [
		{
			filePath: 'a1/a2/a3/file1',
		},
		{
			filePath: 'a1/a2/a3/file2',
		},
		{
			filePath: 'a1/a2/file3',
		},
		{
			filePath: 'a1/file4',
		},
	]
	const detective = new Detective([])
	const tree = new FileTree(files, detective)

	t.match(tree.root, {
		a1: {
			a2: {
				a3: {
					file1: {
						filePath: 'a1/a2/a3/file1',
					},
					file2: {
						filePath: 'a1/a2/a3/file2',
					},
				},
				file3: {
					filePath: 'a1/a2/file3',
				},
			},
			file4: {
				filePath: 'a1/file4',
			},
		},
	})
})

t.test('prune recursive under okay license file', async (t) => {
	const detective = new Detective(['ruby'])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {
				LICENSE: {
					filePath: 'a1/a2/LICENSE',
					isLegalDocument: true,
					licenses: ['ruby'],
				},
				file2: {
					filePath: 'a1/a2/file2',
				},
			},
			file3: {
				filePath: 'a1/file3',
			},
		},
		file4: {
			filePath: 'file4',
		},
	}
	tree.pruneLevelsWithAcceptedLicenses()

	t.match(tree.root, {
		a1: {
			// a2 is gone.
			file3: {
				filePath: 'a1/file3',
			},
		},
		file4: {
			filePath: 'file4',
		},
	})
})

t.test('prune empty nodes', async (t) => {
	const detective = new Detective([])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {},
			file3: {
				filePath: 'a1/file3',
			},
		},
		b1: {
			b2: {
				b3: {},
			},
		},
	}
	tree.pruneEmptyNodes()

	t.match(tree.root, {
		a1: {
			// a2 is gone.
			file3: {
				filePath: 'a1/file3',
			},
		},
		// b1 is gone.
	})
})

t.test('prune individually accepted', async (t) => {
	const detective = new Detective(['ruby'])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {
				// Prune due to manually accepted.
				LICENSE: <AnalysedFile>{
					filePath: 'a1/a2/LICENSE',
					isLegalDocument: true,
					currentAcceptedAt: new Date(),
					licenses: ['gpl-1.0'],
				},
				// Prune due to no license findings.
				file2: <AnalysedFile>{
					filePath: 'a1/a2/file2',
				},
			},
			// Prune due to only okay licenses.
			file3: <AnalysedFile>{
				filePath: 'a1/file3',
				licenses: ['ruby'],
			},
		},
		file4: <AnalysedFile>{
			// NOT pruned because of not explicitly allowed license.
			filePath: 'file4',
			licenses: ['gpl-2.0'],
		},
	}
	tree.pruneAllowedFiles()

	t.match(tree.root, {
		a1: {
			a2: {},
		},
		file4: <AnalysedFile>{
			filePath: 'file4',
			licenses: ['gpl-2.0'],
		},
	})
})

t.test('count leaves', async (t) => {
	const detective = new Detective([])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {
				LICENSE: <AnalysedFile>{
					filePath: 'a1/a2/LICENSE',
				},
				file2: <AnalysedFile>{
					filePath: 'a1/a2/file2',
				},
			},
			file3: <AnalysedFile>{
				filePath: 'a1/file3',
			},
		},
		file4: <AnalysedFile>{
			filePath: 'file4',
		},
	}
	const count = tree.countLeaves()

	t.match(count, 4)
})

t.test('apply to leaves', async (t) => {
	const detective = new Detective([])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {
				LICENSE: <AnalysedFile>{
					filePath: 'a1/a2/LICENSE',
				},
				file2: <AnalysedFile>{
					filePath: 'a1/a2/file2',
				},
			},
			file3: <AnalysedFile>{
				filePath: 'a1/file3',
			},
		},
		file4: <AnalysedFile>{
			filePath: 'file4',
		},
	}
	const paths: string[] = []
	await tree.applyToLeaves(tree.root, async (file) => {
		paths.push(file.filePath)
	})

	t.match(paths, ['a1/a2/LICENSE', 'a1/a2/file2', 'a1/file3', 'file4'])
})
