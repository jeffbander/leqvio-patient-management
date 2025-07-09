// Character Analysis Utility
// Run this in browser console or Node.js to analyze any string

function analyzeCharacters(text) {
  console.log(`\n=== CHARACTER ANALYSIS FOR: "${text}" ===`);
  console.log(`String length: ${text.length}`);
  console.log(`Characters breakdown:`);
  
  Array.from(text).forEach((char, index) => {
    const code = char.charCodeAt(0);
    const hex = code.toString(16).toUpperCase().padStart(4, '0');
    const name = getCharacterName(code);
    console.log(`  [${index.toString().padStart(2, ' ')}] "${char}" → U+${hex} (${code}) ${name}`);
  });
  
  // Check for problematic characters
  const issues = [];
  if (text.includes('\uFEFF')) issues.push('BOM detected (U+FEFF)');
  if (text.includes('\u200B')) issues.push('Zero-width space detected (U+200B)');
  if (text.includes('\u200C')) issues.push('Zero-width non-joiner detected (U+200C)');
  if (text.includes('\u200D')) issues.push('Zero-width joiner detected (U+200D)');
  if (text.includes('\u00A0')) issues.push('Non-breaking space detected (U+00A0)');
  if (text.includes('\uFF3F')) issues.push('Fullwidth underscore detected (U+FF3F)');
  
  if (issues.length > 0) {
    console.log(`\n⚠️  ISSUES FOUND:`);
    issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log(`\n✅ No problematic Unicode characters detected`);
  }
  
  // Verify all characters are AppSheet-safe
  const validPattern = /^[a-zA-Z0-9_]+$/;
  const isValid = validPattern.test(text);
  console.log(`\n${isValid ? '✅' : '❌'} AppSheet compatibility: ${isValid ? 'VALID' : 'INVALID'}`);
  
  if (!isValid) {
    const invalidChars = Array.from(text).filter(c => !/[a-zA-Z0-9_]/.test(c));
    console.log(`Invalid characters: ${[...new Set(invalidChars)].join(', ')}`);
  }
  
  console.log(`\n=== END ANALYSIS ===\n`);
}

function getCharacterName(code) {
  if (code >= 65 && code <= 90) return 'UPPERCASE LETTER';
  if (code >= 97 && code <= 122) return 'LOWERCASE LETTER';
  if (code >= 48 && code <= 57) return 'DIGIT';
  if (code === 95) return 'UNDERSCORE';
  if (code === 32) return 'SPACE';
  if (code === 45) return 'HYPHEN-MINUS';
  if (code === 39) return 'APOSTROPHE';
  if (code === 0xFEFF) return 'BYTE ORDER MARK';
  if (code === 0x200B) return 'ZERO WIDTH SPACE';
  if (code === 0x200C) return 'ZERO WIDTH NON-JOINER';
  if (code === 0x200D) return 'ZERO WIDTH JOINER';
  if (code === 0x00A0) return 'NON-BREAKING SPACE';
  if (code === 0xFF3F) return 'FULLWIDTH LOW LINE';
  return 'OTHER';
}

// Example usage:
console.log('='.repeat(60));
console.log('CHARACTER ANALYZER UTILITY LOADED');
console.log('Usage: analyzeCharacters("your_string_here")');
console.log('='.repeat(60));

// Analyze the specific Patient ID you asked about
analyzeCharacters("Hidary_David__09_17_1939");