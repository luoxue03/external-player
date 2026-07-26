const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'external-player.user.js'),
    'utf8'
);
const pornHubOption = source.match(
    /if \(isPornhubUrl\(\)\) \{\s*currentMedia\.mpvOptions\.push\('([^']+)'\);/s
);

assert.ok(pornHubOption, 'Pornhub cookie option was not found');
assert.equal(
    pornHubOption[1],
    '--ytdl-raw-options-append="cookies=cookies.txt"',
    'Pornhub must resolve cookies.txt from the URL handler working directory'
);
assert.doesNotMatch(
    pornHubOption[1],
    /^[A-Za-z]:\\/,
    'Pornhub cookie path must not contain a local drive letter'
);
assert.doesNotMatch(source, /F:\\\\mpv_2026\\\\mpv-lazy\\\\cookies\.txt/);

console.log('Pornhub cookie path tests passed');
