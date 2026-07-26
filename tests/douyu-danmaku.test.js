const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'external-player.user.js'), 'utf8');
const helperMatch = source.match(
    /\/\/ DOUYU_DANMAKU_HELPERS_START([\s\S]*?)\/\/ DOUYU_DANMAKU_HELPERS_END/
);

assert.ok(helperMatch, 'Douyu danmaku helper block was not found');

let requestSequence = 0;
const context = vm.createContext({
    DOUYU_DANMAKU_PIPE_PREFIX: 'mpv-lazy-douyu-',
    DOUYU_DANMAKU_TOKEN_MAX_LENGTH: 64,
    createBridgeRequestId: () => `request-${++requestSequence}`
});
vm.runInContext(`
${helperMatch[1]}
this.helpers = {
    isMpvDanmakuPlayer,
    createDouyuDanmakuSessionId,
    createDouyuDanmakuPipeName,
    buildDouyuDanmakuStartRequest,
    isDouyuDanmakuStarted,
    buildDouyuDanmakuMpvOption,
    prepareDouyuDanmakuLaunch
};
`, context);

const {
    isMpvDanmakuPlayer,
    createDouyuDanmakuSessionId,
    createDouyuDanmakuPipeName,
    buildDouyuDanmakuStartRequest,
    isDouyuDanmakuStarted,
    buildDouyuDanmakuMpvOption,
    prepareDouyuDanmakuLaunch
} = context.helpers;

assert.equal(isMpvDanmakuPlayer({ name: 'MPV' }), true);
assert.equal(isMpvDanmakuPlayer({ name: 'MPVNET' }), false);
assert.equal(isMpvDanmakuPlayer({ name: 'PotPlayer' }), false);

const sessionId = createDouyuDanmakuSessionId();
assert.match(sessionId, /^douyu-[a-z0-9-]+$/i);
assert.ok(sessionId.length <= 64);
const nextSessionId = createDouyuDanmakuSessionId();
assert.notEqual(nextSessionId, sessionId, 'Each launch needs a unique session id');
const pipeName = createDouyuDanmakuPipeName('douyu-session-42');
assert.equal(pipeName, 'mpv-lazy-douyu-session-42');
assert.ok(pipeName.length <= 64);

const request = buildDouyuDanmakuStartRequest({
    requestId: 'request-42',
    roomId: '3168536',
    sessionId: 'douyu-session-42',
    pipeName
});
assert.deepEqual(JSON.parse(JSON.stringify(request)), {
    type: 'startDanmaku',
    requestId: 'request-42',
    roomId: '3168536',
    sessionId: 'douyu-session-42',
    pipeName: 'mpv-lazy-douyu-session-42'
});
assert.equal(isDouyuDanmakuStarted({
    type: 'danmakuStarted', requestId: 'request-42', sessionId: 'douyu-session-42'
}, 'douyu-session-42'), true);
assert.equal(isDouyuDanmakuStarted({
    type: 'danmakuStarted', requestId: 'request-42', sessionId: 'another-session'
}, 'douyu-session-42'), false);
assert.equal(
    buildDouyuDanmakuMpvOption(pipeName),
    String.raw`--input-ipc-server=\\.\pipe\mpv-lazy-douyu-session-42`
);

const directMedia = {
    video: 'https://stream.example.com/live.flv?wsAuth=secret',
    mpvOptions: ['--no-ytdl', '--force-window=immediate'],
    disableBrowserRelay: true
};
const received = [];
const bridge = {
    async startDanmaku(payload) {
        received.push(payload);
        return { type: 'danmakuStarted', requestId: 'request-42', sessionId: payload.sessionId };
    }
};

(async () => {
    const started = await prepareDouyuDanmakuLaunch(
        directMedia, 'douyu', { name: 'MPV' }, '3168536', bridge
    );
    assert.equal(started.started, true);
    assert.equal(started.media.video, directMedia.video);
    assert.equal(started.media.disableBrowserRelay, true);
    assert.equal(received.length, 1);
    assert.equal(received[0].roomId, '3168536');
    assert.equal(received[0].pipeName, started.pipeName);
    assert.equal(received[0].sessionId, started.sessionId);
    assert.ok(started.pipeName.startsWith('mpv-lazy-douyu-'));
    assert.ok(started.pipeName.length <= 64);
    assert.ok(started.media.mpvOptions.includes(buildDouyuDanmakuMpvOption(started.pipeName)));
    assert.equal(
        directMedia.mpvOptions.some(option => option.startsWith('--input-ipc-server=')),
        false
    );

    const secondStarted = await prepareDouyuDanmakuLaunch(
        directMedia, 'douyu', { name: 'MPV' }, '3168536', bridge
    );
    assert.equal(secondStarted.started, true);
    assert.notEqual(secondStarted.sessionId, started.sessionId);
    assert.notEqual(secondStarted.pipeName, started.pipeName);
    assert.notEqual(
        buildDouyuDanmakuMpvOption(secondStarted.pipeName),
        buildDouyuDanmakuMpvOption(started.pipeName)
    );

    const skipped = await prepareDouyuDanmakuLaunch(
        directMedia, 'douyu', { name: 'MPVNET' }, '3168536', bridge
    );
    assert.equal(skipped.started, false);
    assert.equal(received.length, 2, 'Non-MPV players must not start Danmaku');
    assert.equal(
        skipped.media.mpvOptions.some(option => option.startsWith('--input-ipc-server=')),
        false
    );

    const failed = await prepareDouyuDanmakuLaunch(
        directMedia,
        'douyu',
        { name: 'MPV' },
        '3168536',
        { startDanmaku: async () => { throw new Error('bridge unavailable'); } }
    );
    assert.equal(failed.started, false);
    assert.match(failed.error.message, /bridge unavailable/);
    assert.equal(failed.media.video, directMedia.video);
    assert.equal(failed.media.disableBrowserRelay, true);
    assert.equal(
        failed.media.mpvOptions.some(option => option.startsWith('--input-ipc-server=')),
        false,
        'Bridge failure must fail open without attaching an unusable pipe'
    );

    assert.match(source, /async bootstrapLocalBridge\(\)/);
    assert.match(source, /async bootstrapTelegramRelay\(\) \{\s*return this\.bootstrapLocalBridge\(\);/);
    assert.match(source, /async startDanmaku\(\{ roomId, sessionId, pipeName \}\)/);
    assert.match(source, /type: 'stopDanmaku'/);
    assert.match(source, /async prepareLaunchMedia\(player\) \{[\s\S]*?prepareDouyuDanmakuLaunch/);

    console.log('Douyu danmaku tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
