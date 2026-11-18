#if UNITY_EDITOR
using EmotionDriven;
using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

public class EmotionSessionLoggerWindow : EditorWindow
{
    private string sessionName = "Playtest";
    private string testerName = "";
    private string tags = "";
    private EmotionLoggerMode loggerMode = EmotionLoggerMode.Realtime;
    private EmotionLogTarget logTarget = EmotionLogTarget.JSON;
    private float flushInterval = 10f;
    private string localPath = "Logs/EmotionSessions";
    private string mongoURI = "mongodb://localhost:27017";
    private string apiURL = "http://localhost:3000/sessions/upload";
    private string authToken = "";
    private Vector2 scroll;
    private const string LastFileKey = "EmotionDriven.LastSessionFile";

    [MenuItem("Tools/Emotion-Driven/Emotion Logger/Session Manager")]
    public static void ShowWindow() => GetWindow<EmotionSessionLoggerWindow>("Emotion Sessions");

    private void OnInspectorUpdate() => Repaint();

    private void OnGUI()
    {
        scroll = EditorGUILayout.BeginScrollView(scroll);
        var manager = EmotionManager.Instance;
        bool active = EmotionLogger.IsRecording;

        EditorGUILayout.LabelField("Recording", EditorStyles.boldLabel);
        using (new EditorGUI.DisabledScope(active))
        {
            sessionName = EditorGUILayout.TextField("Session name", sessionName);
            testerName = EditorGUILayout.TextField("Tester", testerName);
            tags = EditorGUILayout.TextField("Tags", tags);
            loggerMode = (EmotionLoggerMode)EditorGUILayout.EnumPopup("Write mode", loggerMode);
            if (loggerMode == EmotionLoggerMode.Batch)
                flushInterval = EditorGUILayout.Slider("Flush interval (s)", flushInterval, 1, 60);
            localPath = EditorGUILayout.TextField("Log folder", localPath);
            logTarget = (EmotionLogTarget)EditorGUILayout.EnumPopup("Log target", logTarget);
            if (logTarget is EmotionLogTarget.MongoDB or EmotionLogTarget.Both)
                mongoURI = EditorGUILayout.PasswordField("Mongo URI", mongoURI);
            if (logTarget == EmotionLogTarget.API)
            {
                apiURL = EditorGUILayout.TextField("API URL", apiURL);
                authToken = EditorGUILayout.PasswordField("Auth token", authToken);
            }
        }

        EditorGUILayout.Space();
        if (!Application.isPlaying || !manager)
            EditorGUILayout.HelpBox("Enter Play Mode with an active EmotionManager to record a session.", MessageType.Info);
        using (new EditorGUI.DisabledScope(!Application.isPlaying || !manager || active))
        {
            if (GUILayout.Button("Start recording"))
            {
                try
                {
                    EmotionLogger.StartSession(new EmotionSessionData {
                        SessionName = sessionName, SceneName = SceneManager.GetActiveScene().name,
                        TesterName = testerName, Tags = tags, LoggerMode = loggerMode, LogTarget = logTarget,
                        LocalPath = localPath, MongoURI = mongoURI, FlushInterval = flushInterval
                    }, apiURL, authToken);
                    SessionState.SetString(LastFileKey, EmotionLogger.SessionPath);
                }
                catch (Exception ex) { EditorUtility.DisplayDialog("Recording could not start", ex.Message, "OK"); }
            }
        }

        if (active)
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Save now")) EmotionLogger.ForceSave();
                if (GUILayout.Button("Finish recording")) EmotionLogger.EndSession();
            }
            EditorGUILayout.LabelField("Stimulus events", EmotionLogger.EventCount.ToString("N0"));
            EditorGUILayout.LabelField("Last event", EmotionLogger.LastEventTime?.ToString("T") ?? "Waiting for stimulus");
        }
        if (Application.isPlaying && manager)
            EditorGUILayout.LabelField("Latest input", manager.HasSample
                ? $"{manager.Latest.Label} · {manager.Latest.Source}"
                : "Waiting for emotion input");

        EditorGUILayout.Space();
        var lastFile = SessionState.GetString(LastFileKey, "");
        if (!active && File.Exists(lastFile) && GUILayout.Button("View last recording"))
            EmotionDashboard.OpenRecording(lastFile);
        if (GUILayout.Button("Open analytics dashboard")) EmotionDashboard.Open();
        if (GUILayout.Button("Open log folder"))
        {
            string path = Path.Combine(Application.persistentDataPath, localPath);
            Directory.CreateDirectory(path);
            EditorUtility.RevealInFinder(path);
        }
        EditorGUILayout.EndScrollView();
    }
}
#endif
