# EmotionDriven

A Unity toolkit for recording the emotion reading associated with each visual, audio or proximity stimulus in a playtest. Its offline dashboard lets you inspect individual events and explore published human ratings of visual stimuli.

## Open the dashboard

Open [the dashboard](Editor/Dashboard/index.html) from a local checkout in a browser, or choose **Tools → Emotion-Driven → Analytics Dashboard** in Unity. When browsing GitHub, download the HTML file and open it locally. The HTML includes its scripts, styles and reference data.

**Reference data** opens with 184,939 human ratings of 900 OASIS images. Filter by category or search by image ID or name. Each plotted point is one image. The top-level valence and arousal means weight each individual rating equally on its original 1–7 scale.

**Playtest sessions** accepts one or more Unity JSONL recordings. Select a recording, filter by stimulus or input source, and inspect event timing, object IDs, features and emotion readings. Export CSV uses the current filters and includes every matching row across all pages. Session data stays in the current browser tab. Reopen the log to see subsequently saved events.

## Install and record

1. Import [emotiondriven.unitypackage](emotiondriven.unitypackage) into a Unity 2021.3 LTS project with .NET Standard 2.1 compatibility. Alternatively, copy the checkout into an `Assets/EmotionDriven` folder. The package includes the editor tools, runtime, prefabs and the MongoDB assemblies used by the existing optional MongoDB log target.
2. Open **Tools → Emotion-Driven → Setup Wizard…** and add an EmotionManager. Choose **Add camera receiver** for the linked camera detector, or add **UdpEmotionReceiver** for a scored UDP source. Configure one input source as described below.
3. Give the scene a camera tagged **MainCamera** and a game object with a visual, audio or proximity stimulus component. The component adds its required TrackableObject.
4. Enter Play Mode. Open **Tools → Emotion-Driven → Emotion Logger → Session Manager**, name the session and choose **Start recording**. The window shows the latest input, event count and last event time. Approach the tracked object, bring it into view or play its audio depending on the stimulus.
5. Choose **Finish recording → View last recording** to open the recorded session directly in the dashboard. **Open log folder** reveals the original files. Each recording gets a distinct filename, including when you reuse a session name. The default folder is `Logs/EmotionSessions` under `Application.persistentDataPath`.

The [legacy prototype archive](Samples~/legacy-prototype.unitypackage) preserves the original sample-game assets. Use the root package for the current toolkit.

### Detector input

For webcam labels, run `emotion_app.py` from the [companion detector](https://github.com/Hama26/emotion_detection) on the same computer. Follow its Python dependency and model setup. **CameraEmotionReceiver** connects to its newline-delimited TCP stream on `127.0.0.1:9999` and reconnects after a disconnect. The detector supplies an emotion label. The dashboard plots these labels over time and leaves confidence, valence and arousal unavailable. Unknown and no-face messages clear the current camera input. The companion can repeat its latest prediction between detections.

For scored readings, the UDP receiver listens on port 5066 by default. Each datagram contains one UTF-8 JSON object. This example illustrates the wire format.

```json
{"label":1,"valence":0.4,"arousal":0.7,"confidence":0.91}
```

Labels 0–7 correspond to Neutral, Happy, Sad, Angry, Fear, Surprise, Disgust and Contempt. Valence uses −1 to 1, arousal and confidence use 0 to 1. A compatible producer supplies all four values. A custom adapter can also call `EmotionManager.UpdateEmotion(EmotionSample)`.

Each stimulus event carries the most recent sample. Event counts and session averages are weighted by stimulus events, so multiple events may share one detector reading. The timeline uses up to 60 equal-duration bins and reports each bin’s mean game time and mean score. The observed span runs between the first and last matching event.

New logs distinguish camera TCP, UDP, mock, adapter and missing input. Before the first detector reading, a stimulus can still produce an event, with emotion metrics displayed as unavailable. Older logs usually lack provenance and appear as **Unspecified**. The prototype’s dummy button used the object ID `DummyObject`. The dashboard identifies these rows separately. Invalid event lines are counted and skipped. Empty recordings open with zero events.

## Reference data and reproducibility

Kurdi, B., Lozano, S., & Banaji, M. R. (2017). *Introducing the Open Affective Standardized Image Set (OASIS).* Behavior Research Methods, 49, 457–470. [Study](https://doi.org/10.3758/s13428-016-0715-3) · [Authors’ data repository](https://osf.io/6pnd7/) · [Original long-form CSV](https://osf.io/download/p8kcu/)

The dashboard bundles each image’s ID, name, category, rating sums and non-missing counts for each dimension. Both experimental focus conditions contribute. Participant records and stimulus images are omitted. The preparation script verifies the source SHA-256 before generating the aggregates.

To reproduce the bundled dashboard with Python 3.11 or newer, run the following from the repository root.

```sh
curl -fL https://osf.io/download/p8kcu/ -o /tmp/OASIS_data_long.csv
python3 Tools~/prepare_oasis.py /tmp/OASIS_data_long.csv
python3 Tools~/build_dashboard.py
```

For runtime components, stimulus options and the existing logging targets, see [the toolkit guide](EmotionDriven_Documentation.md).
