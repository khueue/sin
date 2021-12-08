import { basename } from 'path';
import type { Detective } from './detective';
import type { AnalysedFile } from './types';

// @todo XXX Proper recursive type with AnalysedFile as leaf?
export type TreeNode = Record<string, any>;

export class FileTree {
	root: TreeNode;
	detective: Detective;

	constructor(files: AnalysedFile[], detective: Detective) {
		this.root = this.filesToTree(files);
		this.detective = detective;
	}

	filesToTree(files: AnalysedFile[]) {
		const root: TreeNode = {};
		for (const file of files) {
			let node = root;
			const pathParts = file.filePath.split('/');
			// Make sure nodes exist all the way to the file.
			for (const part of pathParts) {
				if (!node[part]) {
					node[part] = {};
				}
				node = node[part];
			}
			// Populate leaf node in-place.
			Object.assign(node, file);
		}
		return root;
	}

	toJson() {
		return JSON.stringify(this.root, null, '\t') + '\n';
	}

	isFileNode(node: TreeNode): node is AnalysedFile {
		return Boolean(node.filePath);
	}

	pruneLevelsWithAcceptedLicenses() {
		this.root = this.pruneLevelsWithAcceptedLicensesRecursive(this.root);
	}

	pruneLevelsWithAcceptedLicensesRecursive(node: TreeNode) {
		const n: TreeNode = {};
		for (const [key, value] of Object.entries(node)) {
			if (this.isFileNode(value)) {
				n[key] = value;
			} else {
				if (this.acceptedLicenseFileAtLevel(value)) {
					// Ignore all children.
				} else {
					n[key] = this.pruneLevelsWithAcceptedLicensesRecursive(value);
				}
			}
		}
		return n;
	}

	acceptedLicenseFileAtLevel(node: TreeNode) {
		for (const [_, value] of Object.entries(node)) {
			if (this.isFileNode(value)) {
				const fileName = basename(value.filePath).toLowerCase();
				if (value.isLegalDocument && fileName.includes('license')) {
					if (this.detective.allLicensesAreAccepted(value.licenses)) {
						return true;
					}
				}
			}
		}
		return false;
	}

	pruneEmptyNodes() {
		this.root = this.pruneEmptyNodesRecursive(this.root);
	}

	pruneEmptyNodesRecursive(node: TreeNode) {
		const n: TreeNode = {};
		for (const [key, value] of Object.entries(node)) {
			if (this.isFileNode(value)) {
				n[key] = value;
			} else {
				const pruned = this.pruneEmptyNodesRecursive(value);
				if (Object.keys(pruned).length) {
					n[key] = pruned;
				}
			}
		}
		return n;
	}

	pruneAllowedFiles() {
		this.root = this.pruneAllowedFilesRecursive(this.root);
	}

	pruneAllowedFilesRecursive(node: TreeNode) {
		const n: TreeNode = {};
		for (const [key, value] of Object.entries(node)) {
			if (this.isFileNode(value)) {
				if (this.detective.fileNeedsInvestigation(value)) {
					n[key] = value;
				}
			} else {
				n[key] = this.pruneAllowedFilesRecursive(value);
			}
		}
		return n;
	}

	countLeaves() {
		return this.countLeavesRecursive(this.root);
	}

	countLeavesRecursive(node: TreeNode) {
		let count = 0;
		for (const [_, value] of Object.entries(node)) {
			if (this.isFileNode(value)) {
				count += 1;
			} else {
				count += this.countLeavesRecursive(value);
			}
		}
		return count;
	}

	async applyToLeaves(
		node: TreeNode,
		applyFn: (node: AnalysedFile) => Promise<any>,
	) {
		for (const [_, value] of Object.entries(node)) {
			if (this.isFileNode(value)) {
				await applyFn(value);
			} else {
				await this.applyToLeaves(value, applyFn);
			}
		}
	}
}
