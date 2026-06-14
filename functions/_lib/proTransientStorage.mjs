/**
 * Ephemeral Pro document storage helpers (Cloudflare R2).
 */

const SAFE_FILENAME = /[^a-zA-Z0-9._-]+/g;

export function sanitizeProFilename(name) {
  const base = (name || 'document').trim().slice(0, 180) || 'document';
  return base.replace(SAFE_FILENAME, '_');
}

export function buildProObjectKey(userId, fileName) {
  return `pro/${userId}/${crypto.randomUUID()}/${sanitizeProFilename(fileName)}`;
}

/** Media Lab transient uploads: pro/{userId}/media/{uuid}/{filename} */
export function buildProMediaObjectKey(userId, fileName) {
  return `pro/${userId}/media/${crypto.randomUUID()}/${sanitizeProFilename(fileName)}`;
}

export function assertProObjectKeyForUser(objectKey, userId) {
  if (typeof objectKey !== 'string' || !objectKey.startsWith(`pro/${userId}/`)) {
    return false;
  }
  if (objectKey.includes('..') || objectKey.includes('\\')) {
    return false;
  }
  return true;
}

export function assertProMediaObjectKeyForUser(objectKey, userId) {
  if (!assertProObjectKeyForUser(objectKey, userId)) {
    return false;
  }
  return objectKey.startsWith(`pro/${userId}/media/`);
}

export const PRO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export const MOCK_EXTRACT_CSV = 'Date,Description,Amount\n2026-06-14,Test Extraction,199.00';

export const MOCK_EXTRACT_DELAY_MS = 3000;

export const MOCK_MEDIA_DELAY_MS = 3000;

export const MOCK_CONVERTER_DELAY_MS = 3000;

/** Minimal valid DOCX (mock conversion output). */
export const MOCK_DOCX_BASE64 =
  'UEsDBBQAAAAIANCizlx5bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygUSlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwMEFAAAAAgA0KLOXJv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4IqSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQsFKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIANCizlwzmfZzuAAAAO8AAAARAAAAd29yZC9kb2N1bWVudC54bWxFjkFqwzAQRa8yaJUuajlZlGJsZxFIV4FC2wPI0iQRsWbESI3r21dKF928z2eGx+/3P2GGO0ryTIPaNq0CJMvO02VQX5/H51cFKRtyZmbCQa2Y1H7sl86x/Q5IGYqAUrcM6ppz7LRO9orBpIYjUrmdWYLJpcpFLywuCltMqfjDrHdt+6KD8aSqcmK31owVUpHHA1NZl9HBtMKbmPCBdwMnn8XAuzBsAtvbU6/rb6U8GB/88+n/reMvUEsDBBQAAAAIANCizlyGGx+fdgAAAIwAAAAcAAAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsc02MQQ7CIBAAv0L2bkEPxpjS3voAow/Y0BWIsBCWGP29HD1OJjPz+slJvalJLGzhOBlQxK7skb2Fx307XEBJR94xFSYLXxJYl/lGCftIJMQqajxYLITe61VrcYEyylQq8TDP0jL2gc3riu6FnvTJmLNu/w/Qyw9QSwECFAMUAAAACADQos5ceW4z1+gAAACtAQAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIANCizlyb/TfqrQAAACkBAAALAAAAAAAAAAAAAACAARkBAABfcmVscy8ucmVsc1BLAQIUAxQAAAAIANCizlwzmfZzuAAAAO8AAAARAAAAAAAAAAAAAACAAe8BAAB3b3JkL2RvY3VtZW50LnhtbFBLAQIUAxQAAAAIANCizlyGGx+fdgAAAIwAAAAcAAAAAAAAAAAAAACAAdYCAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzUEsFBgAAAAAEAAQAAwEAAIYDAAAAAA==';

/** Minimal valid PPTX (mock conversion output). */
export const MOCK_PPTX_BASE64 =
  'UEsDBBQAAAAIANCizlye0ypc6QAAALIBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QzU7DMBCEX8XyFcUOHBBCcXrg5wgcygOsnE1i4T95t1X79jhpkQAVjuv5Zma93eYQvNhjIZeikdeqlQKjTYOLk5Hv2+fmTgpiiAP4FNHII5Lc9N32mJFE9UYycmbO91qTnTEAqZQxVmVMJQDXsUw6g/2ACfVN295qmyJj5IaXDNl3jzjCzrN4OtTn0x4FPUnxcAKXLiMhZ+8scNX1Pg6/Wppzg6rOlaHZZbqqgNQXGxbl74Kz77UeprgBxRsUfoFQKZ0z61yQqm9l1f9JF1ZN4+gsDsnuQrWo72HB/xhVABe/PqHXm/efUEsDBBQAAAAIANCizlwbyrjurgAAACwBAAALAAAAX3JlbHMvLnJlbHONz80KwjAMB/BXKbm7Tg8ism4XEXaV+QClzbri+kFTxb29xZMTDx6T/PMLabqnm9kDE9ngBWyrGhh6FbT1RsB1OG8OwChLr+UcPApYkKBrmwvOMpcVmmwkVgxPAqac45FzUhM6SVWI6MtkDMnJXMpkeJTqJg3yXV3vefo0YG2yXgtIvd4CG5aI/9hhHK3CU1B3hz7/OPGVKLJMBrOAGDOPCak03+mqyMDbhq++bF9QSwMEFAAAAAgA0KLOXB9BM7yEAAAAqgAAABQAAABwcHQvcHJlc2VudGF0aW9uLnhtbFWNQQrCMBBFrxJmb6e6EAlNuxMEl3qA0IxtIZmEzCB6e+NOl5/He3+YXimaJ1XZMjvYdz0Y4jmHjRcH99t5dwIj6jn4mJkcvElgGodiSyUhVq9NNC3CYouDVbVYRJlXSl66XIgbe+SavLZZF/z1UsRD3x8x+Y3hG5UYLuEqiuOA/xfjB1BLAQIUAxQAAAAIANCizlye0ypc6QAAALIBAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgA0KLOXBvKuO6uAAAALAEAAAsAAAAAAAAAAAAAAIABGgEAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgA0KLOXB9BM7yEAAAAqgAAABQAAAAAAAAAAAAAAIAB8QEAAHBwdC9wcmVzZW50YXRpb24ueG1sUEsFBgAAAAADAAMAvAAAAKcCAAAAAA==';

export const MEDIA_PRO_ACTIONS = new Set(['remove-bg', 'upscale', 'restore']);
