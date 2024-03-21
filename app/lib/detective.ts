import type { AnalysedFile } from './types.js'

export class Detective {
	allowedLicenses: string[]

	constructor(allowedLicenses: string[]) {
		this.allowedLicenses = allowedLicenses
	}

	fileNeedsInvestigation(node: AnalysedFile) {
		if (node.currentAcceptedAt) {
			return false
		}
		if (this.allLicensesAreAllowed(node.licenses)) {
			return false
		}
		return true
	}

	allLicensesAreAllowed(licenses?: string[]) {
		for (const license of licenses ?? []) {
			if (!this.isAllowedLicense(license)) {
				return false
			}
		}
		return true
	}

	isAllowedLicense(license: string) {
		return this.allowedLicenses.includes(license)
	}
}
