const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'external-player.user.js'), 'utf8');
const helperMatch = source.match(
    /\/\/ CONFIG_MIGRATION_HELPERS_START([\s\S]*?)\/\/ CONFIG_MIGRATION_HELPERS_END/
);
const updateConfigStart = source.indexOf('function updateConfig(defaultConfig, config) {');
const updateConfigEnd = source.indexOf('\nfunction matchParser(', updateConfigStart);

assert.ok(helperMatch, 'Config migration helper block was not found');
assert.ok(updateConfigStart >= 0 && updateConfigEnd > updateConfigStart, 'updateConfig was not found');

const context = vm.createContext({});
vm.runInContext(`
${helperMatch[1]}
${source.slice(updateConfigStart, updateConfigEnd)}
this.configNeedsDefaultMerge = configNeedsDefaultMerge;
this.configNeedsMigration = configNeedsMigration;
this.updateConfig = updateConfig;
`, context);

const { configNeedsDefaultMerge, configNeedsMigration, updateConfig } = context;
const defaults = {
    global: {
        version: '1.2.14.9',
        edgeHide: false,
        parser: {
            ytdlp: {
                regex: []
            }
        }
    },
    players: []
};

const legacySameVersionConfig = {
    global: {
        version: '1.2.14.9',
        parser: {
            ytdlp: {
                regex: []
            }
        }
    },
    players: []
};

assert.equal(
    configNeedsMigration(defaults, legacySameVersionConfig),
    true,
    'A same-version config missing edgeHide must receive default fields'
);
assert.equal(
    configNeedsDefaultMerge(defaults, {
        ...legacySameVersionConfig,
        global: {
            ...legacySameVersionConfig.global,
            edgeHide: false
        }
    }),
    false,
    'New users keep the explicit default false without a repeated migration'
);
assert.equal(
    configNeedsMigration(defaults, {
        ...legacySameVersionConfig,
        global: {
            ...legacySameVersionConfig.global,
            edgeHide: true
        }
    }),
    false,
    'A persisted edgeHide choice must not be reset on reload'
);

const previousVersionConfig = {
    ...legacySameVersionConfig,
    global: {
        ...legacySameVersionConfig.global,
        version: '1.2.14.7',
        edgeHide: true
    }
};
assert.equal(configNeedsMigration(defaults, previousVersionConfig), true);
assert.equal(
    updateConfig(defaults, previousVersionConfig).global.edgeHide,
    true,
    'The 1.2.14.9 version migration must preserve a persisted edgeHide=true choice'
);

console.log('Config migration tests passed');
