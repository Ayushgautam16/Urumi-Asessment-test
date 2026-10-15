import { URL } from 'url';

const BLOCKED_HOSTS = [
  '169.254.169.254',
  'metadata.google.internal',
  '169.254.169.253',
  'fd00:ec2::254',
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
];

export function validateUpstreamUrl(urlString: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: `Invalid protocol '${parsed.protocol}'. Only http and https are allowed.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hosts
    if (BLOCKED_HOSTS.includes(hostname)) {
      return { valid: false, reason: `Host '${hostname}' is restricted for security (SSRF protection).` };
    }

    // Check link-local IP prefixes
    if (hostname.startsWith('169.254.')) {
      return { valid: false, reason: 'Link-local addresses (169.254.x.x) are strictly prohibited.' };
    }

    // Check loopback IP prefixes
    if (hostname.startsWith('127.')) {
      return { valid: false, reason: 'Loopback addresses (127.x.x.x) are prohibited.' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `Malformed URL: ${err.message}` };
  }
}
