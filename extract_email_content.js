// Extract and decode the full email content from recent logs
const fs = require('fs');

// This represents the email content from the logs (truncated version)
const emailSnippet = `--000000000000004c868e0636b78107
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.=
w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang=3D"en" xmlns=3D"http://www.w3.org/1999/xhtml">
<head>
    <meta charset=3D"utf-8">
    <title>research study</title>
    <meta name=3D"viewport" content=3D"width=3Ddevice-width, initial-scale=3D=
1.0">
</head>
<body>`;

// Function to decode quoted-printable
function decodeQuotedPrintable(str) {
  return str
    .replace(/=3D/g, '=')
    .replace(/=([0-9A-F]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/=\r?\n/g, '');
}

// Decode the content
const decoded = decodeQuotedPrintable(emailSnippet);
console.log("Decoded email content:");
console.log(decoded);

// Look for JSON data or ChainRun_ID
const chainIdMatch = decoded.match(/"ChainRun_ID"\s*:\s*"([^"]+)"/);
if (chainIdMatch) {
  console.log("Found ChainRun_ID:", chainIdMatch[1]);
}