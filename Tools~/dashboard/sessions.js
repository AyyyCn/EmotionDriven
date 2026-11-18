// Read both the prototype's indented #SESSION header and the compact logger format.
const emotionLabels = ["Neutral", "Happy", "Sad", "Angry", "Fear", "Surprise", "Disgust", "Contempt"];
const stimulusTypes = ["Visual", "Audio", "Proximity", "Custom"];
const stimulusPhases = ["Enter", "Stay", "Exit"];

function enumName(value, names) {
    return Number.isInteger(value) ? names[value] : names.find(name => name === value);
}

function parseSession(text, filename) {
    const lines = text.trimStart().split(/\r?\n/);
    if (!lines[0].startsWith("#SESSION ")) throw new Error("Missing Unity #SESSION header.");
    let header = lines[0].slice(9).trim();
    let cursor = 1;
    if (header === "{") {
        while (cursor < lines.length && lines[cursor].trim() !== "}") header += "\n" + lines[cursor++];
        if (cursor < lines.length) header += "\n" + lines[cursor++];
    }
    let meta;
    try { meta = JSON.parse(header); }
    catch { throw new Error("Incomplete or invalid session header."); }
    if (typeof meta?.SessionName !== "string") throw new Error("Missing session name.");
    const events = [];
    let skipped = 0;
    for (; cursor < lines.length; cursor++) {
        if (!lines[cursor].trim()) continue;
        try {
            const e = JSON.parse(lines[cursor]);
            const sample = e.Emotion;
            const type = enumName(e.StimulusType, stimulusTypes);
            const phase = enumName(e.Phase, stimulusPhases);
            const label = enumName(sample?.Label, emotionLabels);
            const valid = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
            if (!type || !phase || !label || typeof e.TrackableId !== "string" ||
                !valid(e.Time, 0, Infinity) || !valid(sample.Valence, -1, 1) ||
                !valid(sample.Arousal, 0, 1) || !valid(sample.Confidence, 0, 1)) {
                skipped++;
                continue;
            }
            let source = typeof sample.Source === "string" && sample.Source ? sample.Source : "Unspecified";
            if (source === "Unspecified" && e.TrackableId === "DummyObject") source = "Prototype dummy";
            const hasLabel = source !== "No input";
            const measured = hasLabel && !sample.LabelOnly;
            events.push({time:e.Time, object:e.TrackableId, name:typeof e.TrackableName === "string" ? e.TrackableName : "", type, phase, label:hasLabel ? label : "—", source,
                valence:measured ? sample.Valence : null, arousal:measured ? sample.Arousal : null,
                confidence:measured ? sample.Confidence : null,
                feature:typeof e.FeatureName === "string" ? e.FeatureName : "",
                value:Number.isFinite(e.FeatureValue) ? e.FeatureValue : null});
        } catch { skipped++; }
    }
    events.sort((a,b) => a.time - b.time);
    return {name:meta.SessionName, scene:meta.SceneName, tester:meta.TesterName, tags:meta.Tags, filename, events, skipped};
}
