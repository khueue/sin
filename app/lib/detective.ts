import type { AnalysedFile, LicenseInfo } from './types';

export class Detective {
	allowedSpecificLicenses: string[];
	allowedLicenseCategories: string[];

	constructor(
		allowedSpecificLicenses: string[],
		allowedLicenseCategories: string[],
	) {
		this.allowedSpecificLicenses = allowedSpecificLicenses;
		this.allowedLicenseCategories = allowedLicenseCategories;
	}

	fileNeedsInvestigation(node: AnalysedFile) {
		if (node.currentAcceptedAt) {
			return false;
		}
		if (this.allLicensesAreAccepted(node.licenses)) {
			return false;
		}
		return true;
	}

	allLicensesAreAccepted(licenses?: LicenseInfo[]) {
		for (const license of licenses ?? []) {
			if (!this.isAcceptedLicense(license)) {
				return false;
			}
		}
		return true;
	}

	isAcceptedLicense(license: LicenseInfo) {
		if (this.allowedSpecificLicenses.includes(license.name)) {
			return true;
		}
		if (this.allowedLicenseCategories.includes(license.category)) {
			return true;
		}
		return false;
	}
}
