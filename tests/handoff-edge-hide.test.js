const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'external-player.user.js'),
    'utf8'
);
const helperMatch = source.match(
    /\/\/ HANDOFF_EDGE_HIDE_HELPERS_START([\s\S]*?)\/\/ HANDOFF_EDGE_HIDE_HELPERS_END/
);
assert.ok(helperMatch, 'Handoff edge-hide helper block was not found');

const context = vm.createContext({});
vm.runInContext(`
${helperMatch[1]}
this.helpers = {
    HANDOFF_EDGE_HIDE_DELAY,
    HANDOFF_INITIAL_EDGE_HIDE_DELAY,
    canHideHandoffAtEdge,
    shouldAutoOpenHandoffPanel
};
`, context);

const {
    HANDOFF_EDGE_HIDE_DELAY,
    HANDOFF_INITIAL_EDGE_HIDE_DELAY,
    canHideHandoffAtEdge,
    shouldAutoOpenHandoffPanel
} = context.helpers;

assert.equal(HANDOFF_EDGE_HIDE_DELAY, 450, 'Mouseleave keeps the existing 450ms delay');
assert.equal(
    HANDOFF_INITIAL_EDGE_HIDE_DELAY,
    1200,
    'Initial automatic preview settles after about 1.2 seconds'
);

const idleAtEdge = {
    edgeHide: true,
    hasButton: true,
    panelOpen: false,
    isDragging: false,
    isHovered: false,
    hasFocus: false,
    settingsOpen: false
};
assert.equal(canHideHandoffAtEdge(idleAtEdge), true);
for (const protectedState of [
    { panelOpen: true },
    { isDragging: true },
    { isHovered: true },
    { hasFocus: true },
    { settingsOpen: true }
]) {
    assert.equal(
        canHideHandoffAtEdge({ ...idleAtEdge, ...protectedState }),
        false,
        `Explicit interaction must prevent initial edge hide: ${Object.keys(protectedState)[0]}`
    );
}
assert.equal(shouldAutoOpenHandoffPanel(true, 'resolving'), false);
assert.equal(shouldAutoOpenHandoffPanel(true, 'success'), false);
assert.equal(shouldAutoOpenHandoffPanel(false, 'resolving'), true);

const showButtonDivStart = source.indexOf('function showButtonDiv() {');
const showButtonDivEnd = source.indexOf('// ========================================', showButtonDivStart);

assert.ok(showButtonDivStart >= 0, 'showButtonDiv was not found');
assert.ok(showButtonDivEnd > showButtonDivStart, 'showButtonDiv boundary was not found');

const showButtonDiv = source.slice(showButtonDivStart, showButtonDivEnd);
const displayIndex = showButtonDiv.indexOf("setHandoffHostDisplay('flex');");
const scheduleIndex = showButtonDiv.indexOf('// INITIAL_EDGE_HIDE_SCHEDULE_START');

assert.ok(displayIndex >= 0, 'showButtonDiv must display the handoff control first');
assert.ok(scheduleIndex > displayIndex, 'Initial edge hide must be scheduled after display');
assert.match(
    showButtonDiv,
    /\/\/ INITIAL_EDGE_HIDE_SCHEDULE_START\s*scheduleHandoffInitialEdgeHide\(\);\s*\/\/ INITIAL_EDGE_HIDE_SCHEDULE_END/
);
assert.match(
    source,
    /function scheduleHandoffEdgeHide\(\) \{[\s\S]*?HANDOFF_EDGE_HIDE_DELAY/
);
assert.match(
    source,
    /function scheduleHandoffInitialEdgeHide\(\) \{[\s\S]*?handoffInitialPreviewStarted[\s\S]*?HANDOFF_INITIAL_EDGE_HIDE_DELAY/
);
assert.equal(
    [...source.matchAll(/\bscheduleHandoffInitialEdgeHide\(\);/g)].length,
    1,
    'Background status updates must not restart the one-time initial preview'
);
assert.match(
    source,
    /if \(shouldAutoOpenHandoffPanel\(edgeHide, state\)\) \{\s*setHandoffPanelOpen\(true\);\s*\}/
);

console.log('Handoff edge-hide initialization tests passed');
