import { Detective } from './detective';
import { FileTree } from './tree';
import type { AnalysedFile } from './types';

test('empty tree', () => {
	const files: AnalysedFile[] = [];
	const detective = new Detective([], []);
	const tree = new FileTree(files, detective);

	expect(tree.root).toEqual({});
});

test('non-empty tree', () => {
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
	];
	const detective = new Detective([], []);
	const tree = new FileTree(files, detective);

	expect(tree.root).toEqual({
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
	});
});

test('prune recursive under okay license file', () => {
	const detective = new Detective(['Ruby License'], []);
	const tree = new FileTree([], detective);
	tree.root = {
		a1: {
			a2: {
				LICENSE: {
					filePath: 'a1/a2/LICENSE',
					isLegalDocument: true,
					licenses: [
						{
							name: 'Ruby License',
							category: '',
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
	};
	tree.pruneLevelsWithAcceptedLicenses();

	expect(tree.root).toEqual({
		a1: {
			// a2 is gone.
			file3: {
				filePath: 'a1/file3',
			},
		},
		file4: {
			filePath: 'file4',
		},
	});
});

test('prune empty nodes', () => {
	const detective = new Detective([], []);
	const tree = new FileTree([], detective);
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
	};
	tree.pruneEmptyNodes();

	expect(tree.root).toEqual({
		a1: {
			// a2 is gone.
			file3: {
				filePath: 'a1/file3',
			},
		},
		// b1 is gone.
	});
});

test('prune individually accepted', () => {
	const detective = new Detective(['Ruby License'], ['Permissive']);
	const tree = new FileTree([], detective);
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
							name: 'some license',
							category: 'some category',
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
						name: 'Ruby License',
						category: '',
					},
					{
						name: '',
						category: 'Permissive',
					},
				],
			} as AnalysedFile,
		},
		file4: {
			// NOT pruned because of not explicitly allowed license.
			filePath: 'file4',
			licenses: [
				{
					name: 'some license',
					category: '',
				},
			],
		} as AnalysedFile,
	};
	tree.pruneAllowedFiles();

	expect(tree.root).toEqual({
		a1: {
			a2: {},
		},
		file4: {
			filePath: 'file4',
			licenses: [
				{
					name: 'some license',
					category: '',
				},
			],
		} as AnalysedFile,
	});
});

test('count leaves', () => {
	const detective = new Detective([], []);
	const tree = new FileTree([], detective);
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
	};
	const count = tree.countLeaves();

	expect(count).toBe(4);
});

test('apply to leaves', async () => {
	const detective = new Detective([], []);
	const tree = new FileTree([], detective);
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
	};
	const paths: string[] = [];
	await tree.applyToLeaves(tree.root, async (file) => {
		paths.push(file.filePath);
	});

	expect(paths).toEqual(['a1/a2/LICENSE', 'a1/a2/file2', 'a1/file3', 'file4']);
});
