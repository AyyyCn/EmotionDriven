"use strict";
const $ = id => document.getElementById(id);
const number = n => n.toLocaleString("en-US");
const fixed = n => Number.isFinite(n) ? n.toFixed(2) : "—";
const pct = n => Number.isFinite(n) ? (n * 100).toFixed(1) + "%" : "—";
const colors = ["#257362", "#bf713b", "#7178ac", "#bc576d", "#527da0", "#927827", "#568542", "#805a74"];
const categories = [...new Set(oasisRatings.map(r => r[2]))].sort();
const categoryColor = name => colors[categories.indexOf(name)];
const sessions = new Map();
let mode, page = 0, rows = [], columns = [], plot = null, targets = [];
const pageSize = 15;

function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
}
function options(id, list, all) {
    const select = $(id);
    select.replaceChildren();
    if (all) select.add(new Option(all, ""));
    for (const item of list) select.add(new Option(item, item));
}
function changeMode(next) {
    mode = next;
    const ref = mode === "reference";
    $("reference-tab").setAttribute("aria-current", ref ? "page" : "false");
    $("sessions-tab").setAttribute("aria-current", ref ? "false" : "page");
    $("title").textContent = ref ? "Affective atlas" : "Playtest sessions";
    $("description").textContent = ref
        ? "Explore how people rated the valence and arousal of images in the OASIS study."
        : "Explore emotion readings recorded during encounters with game stimuli.";
    $("session-field").hidden = $("source-field").hidden = ref;
    $("citation").hidden = !ref;
    $("filter-label").textContent = ref ? "Category" : "Stimulus";
    $("query").placeholder = ref ? "Image name or ID" : "Object, emotion or feature";
    $("query").value = "";
    options("filter", ref ? categories : stimulusTypes, ref ? "All categories" : "All stimuli");
    updateSources();
    render();
}
function updateSources() {
    const events = sessions.get($("session").value)?.events ?? [];
    options("source", [...new Set(events.map(e => e.source))].sort(), "All sources");
}
function metrics(items) {
    $("metrics").replaceChildren(...items.map(([label, value]) => {
        const item = element("div", undefined, "metric");
        item.append(element("small", label), element("strong", value));
        return item;
    }));
}
function bars(title, caption, items) {
    $("breakdown-title").textContent = title;
    $("breakdown-caption").textContent = caption;
    const total = items.reduce((sum, item) => sum + item[1], 0);
    $("bars").replaceChildren(...items.map(([name, value, color]) => {
        const bar = element("div", undefined, "bar");
        const head = element("div");
        head.append(element("span", name), element("b", number(value)));
        const track = element("div", undefined, "track"), fill = element("i");
        fill.style.width = (total ? value / total * 100 : 0) + "%";
        fill.style.backgroundColor = color;
        track.append(fill);
        bar.append(head, track);
        return bar;
    }));
}
function chart(title, caption, config, legend) {
    $("chart-title").textContent = title;
    $("chart-caption").textContent = caption;
    $("plot").setAttribute("aria-label", title + ". " + caption + " Details appear in the table below.");
    $("legend").replaceChildren(...legend.map(([name, color]) => {
        const key = element("span", name);
        key.style.setProperty("--tone", color);
        return key;
    }));
    plot = config;
    draw();
}
function renderReference(filter, query) {
    const data = oasisRatings.filter(r => (!filter || r[2] === filter) &&
        (r[0] + " " + r[1]).toLowerCase().includes(query));
    const sum = i => data.reduce((n,r) => n + r[i], 0);
    const valenceCount = sum(4), arousalCount = sum(6);
    metrics([["Images", number(data.length)], ["Human ratings", number(valenceCount + arousalCount)],
        ["Mean valence / 7", fixed(sum(3) / valenceCount)], ["Mean arousal / 7", fixed(sum(5) / arousalCount)]]);
    const counts = categories.map(c => [c, data.filter(r => r[2] === c).length, categoryColor(c)]);
    bars("Image categories", "Images in the current selection.", counts);
    chart("Valence × arousal", "Each point is one image’s average rating on the study’s 1–7 scales.", {
        xmin:1, xmax:7, ymin:1, ymax:7, xlabel:"Valence", ylabel:"Arousal",
        points:data.map(r => ({x:r[3]/r[4], y:r[5]/r[6], color:categoryColor(r[2]), name:r[1]}))
    }, counts.filter(c => c[1]).map(c => [c[0], c[2]]));
    $("table-title").textContent = "Stimulus ratings";
    $("table-caption").textContent = "Image means and the number of individual ratings behind each mean.";
    columns = ["Image ID", "Image", "Category", "Valence", "Valence ratings", "Arousal", "Arousal ratings"];
    rows = data.map(r => [r[0], r[1], r[2], fixed(r[3]/r[4]), r[4], fixed(r[5]/r[6]), r[6]]);
}
function renderSession(session, filter, query) {
    const source = $("source").value;
    const data = session.events.filter(e => (!filter || e.type === filter) && (!source || e.source === source) &&
        (e.object + " " + e.name + " " + e.label + " " + e.feature).toLowerCase().includes(query));
    const info = [session.scene, session.tester, session.tags].filter(Boolean).join(" · ");
    const skipped = session.skipped ? number(session.skipped) + " invalid event rows skipped." : "";
    const provenance = session.events.some(e => e.source === "Unspecified") ? "Some events have no recorded input source." : "";
    $("metadata").textContent = [info, skipped, provenance].filter(Boolean).join("  ");
    $("metadata").hidden = !$("metadata").textContent;
    const first = data[0]?.time ?? 0, last = data[data.length - 1]?.time ?? 0;
    const labeled = data.filter(e => e.label !== "—");
    const measured = labeled.filter(e => e.confidence !== null);
    const avg = field => measured.reduce((n,e) => n + e[field], 0) / measured.length;
    metrics([["Stimulus events", number(data.length)], ["Tracked objects", number(new Set(data.map(e => e.object)).size)],
        ["Mean confidence", pct(avg("confidence"))], ["Observed event span", data.length ? fixed(last - first) + " s" : "—"]]);
    const counts = emotionLabels.map((label,i) => [label, labeled.filter(e => e.label === label).length, colors[i]]);
    bars("Emotion labels", "Number of stimulus events carrying each label.", counts);
    if (labeled.length && !measured.length) {
        const labels = counts.filter(item => item[1]).map(item => item[0]);
        const points = labeled.map(e => ({x:e.time, y:labels.indexOf(e.label),
            color:colors[emotionLabels.indexOf(e.label)], name:e.label, detail:fixed(e.time) + " s"}));
        chart("Labels over time", "Each point is a stimulus event with a recorded emotion label.", {
            xmin:first, xmax:last > first ? last : first + 1, ymin:-0.5, ymax:labels.length - 0.5,
            xlabel:"Game time (s)", ylabel:"", labels, points
        }, []);
    } else {
        drawScoreTimeline(data, measured, first, last);
    }
    $("table-title").textContent = "Recorded events";
    $("table-caption").textContent = "One row per stimulus event, ordered by game time.";
    columns = ["Time (s)", "Object", "Object ID", "Stimulus", "Phase", "Emotion", "Source", "Valence", "Arousal", "Confidence", "Feature", "Value"];
    rows = data.map(e => [e.time, e.name || "—", e.object, e.type, e.phase, e.label, e.source, e.valence ?? "—", e.arousal ?? "—", e.confidence === null ? "—" : pct(e.confidence), e.feature, e.value ?? ""]);
}
function drawScoreTimeline(data, measured, first, last) {
    // At most 60 time bins. Every matching event contributes to its bin's mean.
    const binCount = last > first ? Math.min(60, data.length) : 1;
    const bins = Array.from({length:binCount}, () => ({time:0, valence:0, arousal:0, count:0}));
    for (const e of measured) {
        const i = last === first ? 0 : Math.min(binCount - 1, Math.floor((e.time-first)/(last-first)*binCount));
        const b = bins[i];
        b.time += e.time; b.valence += e.valence; b.arousal += e.arousal; b.count++;
    }
    const points = [];
    for (const key of ["valence","arousal"]) {
        for (const b of bins) if (b.count) points.push({x:b.time/b.count, y:b[key]/b.count,
            color:key === "valence" ? colors[0] : colors[1], name:key + " · " + number(b.count) + " events"});
    }
    chart("Emotion over time", "Scored events only. Each point averages a time interval. Valence ranges from −1 to 1 and arousal from 0 to 1.", {
        xmin:first, xmax:last > first ? last : first + 1, ymin:-1, ymax:1, xlabel:"Game time (s)", ylabel:"Score", points
    }, [["Valence", colors[0]], ["Arousal", colors[1]]]);
}
function render() {
    page = 0;
    $("metadata").hidden = true;
    const session = sessions.get($("session").value);
    const empty = mode === "sessions" && !session;
    $("analysis").hidden = empty;
    $("empty").hidden = !empty;
    if (empty) { plot = null; return; }
    const filter = $("filter").value, query = $("query").value.trim().toLowerCase();
    if (mode === "reference") renderReference(filter, query);
    else renderSession(session, filter, query);
    renderTable();
}
function renderTable() {
    const tr = element("tr");
    tr.append(...columns.map(c => element("th", c)));
    document.querySelector("thead").replaceChildren(tr);
    const start = page * pageSize, end = Math.min(start + pageSize, rows.length);
    document.querySelector("tbody").replaceChildren(...rows.slice(start,end).map(row => {
        const line = element("tr");
        line.append(...row.map(v => element("td", v)));
        return line;
    }));
    $("range").textContent = rows.length ? number(start+1) + "–" + number(end) + " of " + number(rows.length) : "No matching records";
    $("prev").disabled = !page;
    $("next").disabled = end >= rows.length;
    $("export").disabled = !rows.length;
}
function draw() {
    if (!plot || $("analysis").hidden) return;
    const canvas = $("plot"), w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!w || !h) return;
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
    const left = plot.labels ? 68 : 45, right = w-22, top = 13, bottom = h-40;
    const {xmin,xmax,ymin,ymax,points} = plot;
    const x = v => left + (v-xmin)/(xmax-xmin)*(right-left);
    const y = v => bottom - (v-ymin)/(ymax-ymin)*(bottom-top);
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#435e55"; ctx.strokeStyle = "#dde4d8";
    const ticks = mode === "reference" ? 6 : 4;
    const tick = n => Number(n.toFixed(2)).toString();
    for (let i=0; i<=ticks; i++) {
        const vx = xmin + i/ticks*(xmax-xmin), vy = ymin + i/ticks*(ymax-ymin);
        ctx.beginPath(); ctx.moveTo(x(vx),top); ctx.lineTo(x(vx),bottom);
        if (!plot.labels) { ctx.moveTo(left,y(vy)); ctx.lineTo(right,y(vy)); }
        ctx.stroke();
        ctx.textAlign="center"; ctx.fillText(tick(vx),x(vx),bottom+15);
        ctx.textAlign="right"; if (!plot.labels) ctx.fillText(tick(vy),left-6,y(vy)+4);
    }
    if (plot.labels) plot.labels.forEach((label, index) => {
        ctx.textAlign = "right"; ctx.fillText(label, left-6, y(index)+4);
        ctx.beginPath(); ctx.moveTo(left, y(index)); ctx.lineTo(right, y(index)); ctx.stroke();
    });
    ctx.textAlign="center"; ctx.fillText(plot.xlabel,(left+right)/2,h-5);
    ctx.save(); ctx.translate(11,(bottom+top)/2); ctx.rotate(-Math.PI/2); ctx.fillText(plot.ylabel,0,0); ctx.restore();
    targets = []; $("tip").hidden = true;
    for (const p of points) {
        const px = x(p.x), py = y(p.y);
        ctx.fillStyle = p.color; ctx.globalAlpha = .72;
        ctx.beginPath(); ctx.arc(px,py,3.8,0,2*Math.PI); ctx.fill();
        targets.push({px,py,p});
    }
    ctx.globalAlpha = 1;
}
$("plot").addEventListener("pointermove", e => {
    const tip = $("tip");
    let best, distance = 100;
    for (const pt of targets) {
        const d = (pt.px-e.offsetX)**2 + (pt.py-e.offsetY)**2;
        if (d < distance) { best = pt; distance = d; }
    }
    tip.hidden = !best;
    if (!best) return;
    tip.textContent = best.p.name + " · " + (best.p.detail ?? (fixed(best.p.x) + ", " + fixed(best.p.y)));
    tip.style.left = Math.max(0,Math.min(best.px+8, $("plot").clientWidth-tip.offsetWidth)) + "px";
    tip.style.top = Math.max(0,best.py-tip.offsetHeight-6) + "px";
});
$("plot").onpointerleave = () => $("tip").hidden = true;
new ResizeObserver(draw).observe($("plot"));
$("prev").onclick = () => { page--; renderTable(); };
$("next").onclick = () => { page++; renderTable(); };
$("filter").onchange = $("source").onchange = $("query").oninput = render;
$("session").onchange = () => { updateSources(); render(); };
$("reference-tab").onclick = () => { location.hash = "reference"; };
$("sessions-tab").onclick = () => { location.hash = "sessions"; };
window.addEventListener("hashchange", () => changeMode(location.hash === "#sessions" ? "sessions" : "reference"));
$("export").onclick = () => {
    const quote = value => {
        let text = String(value);
        if (typeof value === "string" && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
        return '"' + text.replaceAll('"','""') + '"';
    };
    const csv = [columns,...rows].map(row => row.map(quote).join(",")).join("\r\n");
    const link = element("a");
    link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    link.download = mode === "reference" ? "oasis-ratings.csv" : "stimulus-events.csv";
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
function addSession(session, key) {
    if (!sessions.has(key)) $("session").add(new Option(session.name + " · " + session.filename, key));
    sessions.set(key, session);
    $("session").value = key;
}
$("files").onchange = async () => {
    const files = Array.from($("files").files), errors = [];
    let imported = 0;
    for (const file of files) {
        try {
            const bytes = await file.arrayBuffer();
            const session = parseSession(new TextDecoder().decode(bytes), file.name);
            // Two runs can share both a filename and metadata, especially with prototype logs.
            const digest = window.crypto?.subtle ? await crypto.subtle.digest("SHA-256", bytes) : null;
            const key = digest ? Array.from(new Uint8Array(digest)).join(".") : String(sessions.size);
            addSession(session, key);
            imported++;
        } catch (err) { errors.push(file.name + " — " + err.message); }
    }
    $("files").value = "";
    $("notice").hidden = !errors.length;
    $("notice").textContent = errors.join("\n");
    if (imported) {
        location.hash = "sessions";
        changeMode("sessions");
    }
};
const embedded = $("recording");
if (embedded) {
    const bytes = Uint8Array.from(atob(embedded.textContent), c => c.charCodeAt(0));
    addSession(parseSession(new TextDecoder().decode(bytes), "Unity recording"), "embedded");
}
changeMode(location.hash === "#sessions" ? "sessions" : "reference");
