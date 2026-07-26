const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const userscriptPath = path.join(root, 'external-player.user.js');
const source = fs.readFileSync(userscriptPath, 'utf8');
const helperMatch = source.match(
    /\/\/ DOUYU_HELPERS_START([\s\S]*?)\/\/ DOUYU_HELPERS_END/
);

assert.ok(helperMatch, 'Douyu helper block was not found');

const context = vm.createContext({
    TextEncoder,
    URL
});
vm.runInContext(`
${helperMatch[1]}
this.helpers = {
    douyuMd5,
    buildDouyuAuth,
    extractDouyuRoomId,
    normalizeDouyuQualities,
    selectDouyuQuality,
    buildDouyuDirectMedia
};
`, context);

const {
    douyuMd5,
    buildDouyuAuth,
    extractDouyuRoomId,
    normalizeDouyuQualities,
    selectDouyuQuality,
    buildDouyuDirectMedia
} = context.helpers;

assert.equal(douyuMd5(''), 'd41d8cd98f00b204e9800998ecf8427e');
assert.equal(douyuMd5('abc'), '900150983cd24fb0d6963f7d28e17f72');

const md5 = value => crypto.createHash('md5').update(value).digest('hex');
const encryption = {
    key: 'key-value',
    rand_str: 'random-value',
    enc_time: 2,
    is_special: 0
};
const timestamp = 1784997847;
const roomId = '3168536';
const firstDigest = md5(encryption.rand_str + encryption.key);
const secondDigest = md5(firstDigest + encryption.key);
assert.equal(
    buildDouyuAuth(encryption, roomId, timestamp),
    md5(secondDigest + encryption.key + roomId + timestamp)
);
assert.equal(
    buildDouyuAuth({
        ...encryption,
        is_special: 1
    }, roomId, timestamp),
    md5(secondDigest + encryption.key)
);

assert.equal(extractDouyuRoomId({
    pageRoomId: 42,
    url: 'https://www.douyu.com/3168536'
}), '42');
assert.equal(extractDouyuRoomId({
    html: '$ROOM.room_id = 3168536;',
    url: 'https://www.douyu.com/1'
}), '3168536');
assert.equal(extractDouyuRoomId({
    html: 'roomID: "63280223",',
    url: 'https://www.douyu.com/1'
}), '63280223');
assert.equal(extractDouyuRoomId({
    canonicalUrl: 'https://www.douyu.com/topic/event/3168536'
}), '3168536');
assert.equal(extractDouyuRoomId({
    url: 'https://example.com/3168536'
}), undefined);

const qualities = normalizeDouyuQualities([
    { name: '高清', rate: 2, bit: 2000 },
    { name: '原画', rate: 0, bit: 0 },
    { name: '蓝光 4M', rate: 4, bit: 4000 },
    { name: 'duplicate', rate: 4, bit: 3000 },
    { name: 'invalid', rate: 'not-a-number', bit: 9999 }
]);
assert.deepEqual(
    JSON.parse(JSON.stringify(qualities)),
    [
        { name: '原画', rate: 0, bit: 0 },
        { name: '蓝光 4M', rate: 4, bit: 4000 },
        { name: '高清', rate: 2, bit: 2000 }
    ]
);
assert.equal(selectDouyuQuality(qualities, 'auto').rate, 0);
assert.equal(selectDouyuQuality(qualities, 4).name, '蓝光 4M');
assert.equal(selectDouyuQuality(qualities, 8), undefined);

const media = buildDouyuDirectMedia({
    rtmp_url: 'https://stream.example.com/live/',
    rtmp_live: '/3168536.flv?wsAuth=secret'
}, 'Room title');
assert.equal(media.video, 'https://stream.example.com/live/3168536.flv?wsAuth=secret');
assert.equal(media.referer, 'https://www.douyu.com/');
assert.equal(media.cookie, undefined);
assert.equal(media.sensitiveUrl, true);
assert.equal(media.disableBrowserRelay, true);
assert.deepEqual(
    JSON.parse(JSON.stringify(media.mpvOptions)),
    ['--no-ytdl', '--force-window=immediate']
);

const metadataVersion = source.match(/@version\s+([0-9.]+)/)?.[1];
const defaultConfigVersion = source.match(/const defaultConfig = \{[\s\S]*?version: '([0-9.]+)'/)?.[1];
assert.equal(metadataVersion, '1.2.14.9');
assert.equal(defaultConfigVersion, metadataVersion, 'Userscript and default config versions must match');
assert.match(source, /douyu:\s*\{\s*regex:/);
const douyuRegexLiteral = source.match(/douyu:\s*\{\s*regex:\s*\[\s*(".*?")/s)?.[1];
assert.ok(douyuRegexLiteral, 'Douyu parser regex was not found');
const douyuRegex = new RegExp(JSON.parse(douyuRegexLiteral));
assert.equal(douyuRegex.test('https://www.douyu.com/3168536'), true);
assert.equal(douyuRegex.test('https://www.douyu.com/topic/3168536'), true);
assert.equal(douyuRegex.test('https://www.douyu.com/topic/event/live/3168536?foo=1'), true);
assert.equal(douyuRegex.test('https://www.douyu.com/topic/event/live'), false);
assert.equal(
    [...source.matchAll(/console\.log\(args\);/g)].length,
    1,
    'Only logLaunchArgs may log the unmodified argument array'
);
assert.match(source, /this\.pageUrl = location\.href;/);
assert.match(
    source,
    /const routeRoomId = extractDouyuRoomId\(\{\s*url: this\.pageUrl\s*\}\);/
);
assert.match(
    source,
    /if \(document\.getElementById\(BUTTON_DIV_ID\)\) \{[\s\S]*?cacheHandoffElements\(\);\s*appendPlayButton\(\);\s*return;/
);
assert.match(source, /function logLaunchArgs\(args, media\)/);
const launchLogHelper = source.match(
    /\/\/ LAUNCH_LOG_HELPER_START([\s\S]*?)\/\/ LAUNCH_LOG_HELPER_END/
)?.[1];
assert.ok(launchLogHelper, 'Launch log helper block was not found');
const launchLogs = [];
const logContext = vm.createContext({
    console: {
        log: value => launchLogs.push(value)
    }
});
vm.runInContext(`${launchLogHelper}\nthis.logLaunchArgs = logLaunchArgs;`, logContext);
const signedUrl = '"https://stream.example.com/live.flv?wsAuth=secret"';
logContext.logLaunchArgs([signedUrl, '--no-ytdl'], {
    sensitiveUrl: true
});
assert.deepEqual(
    JSON.parse(JSON.stringify(launchLogs.pop())),
    ['[sensitive media URL redacted]', '--no-ytdl']
);
logContext.logLaunchArgs([signedUrl, '--no-ytdl'], {
    sensitiveUrl: false
});
assert.equal(launchLogs.pop()[0], signedUrl);
assert.match(
    fs.readFileSync(path.join(root, 'setting.html'), 'utf8'),
    /class="input-group parser" id="douyu"/
);

console.log('Douyu parser tests passed');
