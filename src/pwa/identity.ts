/**
 * Returns a cryptographically secure RFC 4122 version 4 UUID.
 *
 * Some older browser engines expose Web Crypto but do not yet provide
 * `crypto.randomUUID()`. Keep identifiers secure in those environments by
 * constructing the UUID from `getRandomValues()` instead.
 */
export function randomUuid(): string {
	const webCrypto = globalThis.crypto
	if (typeof webCrypto?.randomUUID === 'function') {
		return webCrypto.randomUUID()
	}
	if (typeof webCrypto?.getRandomValues !== 'function') {
		throw new Error('Secure random values are unavailable in this browser.')
	}

	const bytes = webCrypto.getRandomValues(new Uint8Array(16))
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
