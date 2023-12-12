import Logger from 'js-logger'

function getDateParts(date: Date) {
	const iso = date.toISOString() // '2021-11-23T07:41:42.261Z'
	return iso.split('.')[0].split('T') // ['2021-11-23', '07:41:42']
}

const nowDate = new Date()

export const nowIso = nowDate.toISOString()

const [d, t] = getDateParts(nowDate)
export const nowSlug = d.replaceAll('-', '') + '-' + t.replaceAll(':', '') // '20211123-074142'

export const dbPath = '/data/db/db.sqlite'
export const sourceRoot = '/data/src'

const sessionTmpDir = `/data/tmp/${nowSlug}`
export const dirtyRoot = `${sessionTmpDir}/dirty`
export const reportRoot = `${sessionTmpDir}/report`
export const testRoot = `${sessionTmpDir}/test`
export const scanCodeBinary = `scancode`
export const scanCodeOutPath = `${reportRoot}/scancode.json`
export const auditOutPath = `${reportRoot}/audit.json`
export const acceptedOutPath = `${reportRoot}/accepted.json`
export const attributionsOutPath = `${reportRoot}/attributions.json`

export const dbWrapInGlobalTransaction = true
export const skipIsDirtyCheck = false
export const skipExtractArchives = false

Logger.useDefaults({
	defaultLevel: Logger.INFO,
	formatter(messages, _context) {
		const [d, t] = getDateParts(new Date())
		const ts = d + ' ' + t
		messages.unshift(`[${ts}]`)
	},
})

export const logger = Logger

export const rawLogger = console
