// Content-Security-Policy for the portal and API. Scripts are limited to same-origin files: no inline <script>
// blocks, inline event handlers (script-src-attr 'none'), eval or third-party script hosts. Inline style attributes
// are still allowed ('unsafe-inline' in style-src) because the existing templates use them extensively; that is a
// styling-injection exposure only, not script execution. Google Fonts is the only third-party stylesheet/font origin.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // https: covers allow-listed external vehicle images; blob: is used for local photo previews before upload.
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
