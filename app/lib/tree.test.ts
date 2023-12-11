import t from 'tap'

import { Detective } from './detective.js'
import { FileTree } from './tree.js'
import type { AnalysedFile } from './types.js'

t.test('empty tree', async (t) => {
	const files: AnalysedFile[] = []
	const detective = new Detective([], [])
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
	const detective = new Detective([], [])
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
	const detective = new Detective(['ruby'], [])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {
				LICENSE: {
					filePath: 'a1/a2/LICENSE',
					isLegalDocument: true,
					licenses: [
						{
							license_expression: 'ruby',
							// category: 'some category',
						},
					],
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
	const detective = new Detective([], [])
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
	const detective = new Detective(['ruby'], [])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {
				// Prune due to manually accepted.
				LICENSE: {
					filePath: 'a1/a2/LICENSE',
					isLegalDocument: true,
					currentAcceptedAt: new Date(),
					licenses: [
						{
							license_expression: 'gpl-1.0',
							// category: 'some category',
						},
					],
				} as AnalysedFile,
				// Prune due to no license findings.
				file2: {
					filePath: 'a1/a2/file2',
				} as AnalysedFile,
			},
			// Prune due to only okay licenses.
			file3: {
				filePath: 'a1/file3',
				licenses: [
					{
						license_expression: 'ruby',
					},
					// {
					// 	name: '',
					// 	category: 'Permissive',
					// },
				],
			} as AnalysedFile,
		},
		file4: {
			// NOT pruned because of not explicitly allowed license.
			filePath: 'file4',
			licenses: [
				{
					license_expression: 'gpl-2.0',
					// category: '',
				},
			],
		} as AnalysedFile,
	}
	tree.pruneAllowedFiles()

	t.match(tree.root, {
		a1: {
			a2: {},
		},
		file4: {
			filePath: 'file4',
			licenses: [
				{
					license_expression: 'gpl-2.0',
					// category: '',
				},
			],
		} as AnalysedFile,
	})
})

t.test('count leaves', async (t) => {
	const detective = new Detective([], [])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {
				LICENSE: {
					filePath: 'a1/a2/LICENSE',
				} as AnalysedFile,
				file2: {
					filePath: 'a1/a2/file2',
				} as AnalysedFile,
			},
			file3: {
				filePath: 'a1/file3',
			} as AnalysedFile,
		},
		file4: {
			filePath: 'file4',
		} as AnalysedFile,
	}
	const count = tree.countLeaves()

	t.match(count, 4)
})

t.test('apply to leaves', async (t) => {
	const detective = new Detective([], [])
	const tree = new FileTree([], detective)
	tree.root = {
		a1: {
			a2: {
				LICENSE: {
					filePath: 'a1/a2/LICENSE',
				} as AnalysedFile,
				file2: {
					filePath: 'a1/a2/file2',
				} as AnalysedFile,
			},
			file3: {
				filePath: 'a1/file3',
			} as AnalysedFile,
		},
		file4: {
			filePath: 'file4',
		} as AnalysedFile,
	}
	const paths: string[] = []
	await tree.applyToLeaves(tree.root, async (file) => {
		paths.push(file.filePath)
	})

	t.match(paths, ['a1/a2/LICENSE', 'a1/a2/file2', 'a1/file3', 'file4'])
})
