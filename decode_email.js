// Decode the email content from the logs
const emailContent = `Received: from mail-il1-f198.google.com (mxd [209.85.166.198]) by mx.sendgrid.net with ESMTP id 7NlBehwZS-aBnc1y_4hwzw for <automation-responses@responses.providerloop.com>; Wed, 04 Jun 2025 04:34:56.771 +0000 (UTC)
Received: by mail-il1-f198.google.com with SMTP id e9e14a558f8ab-3ddc0663b97so4834365ab.2
        for <automation-responses@responses.providerloop.com>; Tue, 03 Jun 2025 21:34:56 -0700 (PDT)
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=appsheet.com; s=20230601;`;

// Look for ChainRun_ID pattern in recent email logs
console.log("Email content analysis:");
console.log("Length:", emailContent.length);

// Check for typical AppSheet automation patterns
const patterns = [
  /"ChainRun_ID"\s*:\s*"([^"]+)"/g,
  /ChainRun_ID[^"]*"([^"]+)"/g,
  /Output from run \(([^)]+)\)/g,
  /run \(([^)]+)\)/g
];

patterns.forEach((pattern, index) => {
  const matches = [...emailContent.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${index + 1} matches:`, matches.map(m => m[1]));
  }
});