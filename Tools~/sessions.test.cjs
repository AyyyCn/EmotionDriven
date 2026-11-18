const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "dashboard/sessions.js"), "utf8");
const parse = vm.runInNewContext(source + "\nparseSession");
const header = {SessionName:"Parser test", SceneName:"Scene"};
const event = {Time:0, TrackableId:"object", StimulusType:0, Phase:1,
    Emotion:{Label:0, Source:"UDP", Valence:0, Arousal:0, Confidence:0}};

test("legacy pretty header, named enums, malformed row and later valid event", () => {
    const row = {...event, StimulusType:"Audio", Phase:"Enter",
        Emotion:{...event.Emotion, Label:"Fear", Source:undefined}};
    const log = "#SESSION " + JSON.stringify(header,null,4) + "\r\npartial\r\n" + JSON.stringify(row);
    const parsed = parse(log, "test.jsonl");
    assert.equal(parsed.skipped, 1);
    assert.equal(parsed.events[0].type, "Audio");
    assert.equal(parsed.events[0].source, "Unspecified");
    assert.equal(parsed.events[0].label, "Fear");
});

test("label-only, missing input and observed zero remain distinguishable", () => {
    const samples = [event.Emotion, {...event.Emotion,Source:"No input"},
        {...event.Emotion,Source:"Camera TCP",Label:7,LabelOnly:true}];
    const lines = samples.map(Emotion => JSON.stringify({...event, Emotion}));
    const {events} = parse(["#SESSION " + JSON.stringify(header), ...lines].join("\n"), "test.jsonl");
    assert.equal(events[0].confidence, 0);
    assert.equal(events[1].label, "—");
    assert.equal(events[1].confidence, null);
    assert.equal(events[2].label, "Contempt");
    assert.equal(events[2].valence, null);
});

test("header-only recording is valid, missing header is reported", () => {
    assert.equal(parse("#SESSION " + JSON.stringify(header), "empty.jsonl").events.length, 0);
    assert.throws(() => parse(JSON.stringify(event), "wrong.jsonl"), /header/i);
});
