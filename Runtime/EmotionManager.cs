// Assets/Scripts/EmotionDriven/Runtime/EmotionManager.cs
using System;
using System.Collections.Generic;
using UnityEngine;

namespace EmotionDriven
{
    public enum EmotionLabel { Neutral, Happy, Sad, Angry, Fear, Surprise, Disgust, Contempt }
    public enum StimulusType  { Visual, Audio, Proximity, Custom }
    public enum StimulusPhase { Enter, Stay, Exit }

    // -------------------------------------------------------------------------
    [Serializable]
    public struct EmotionSample
    {
        public double Time;
        public EmotionLabel Label;
        public string Source;
        public bool LabelOnly;
        [Range(-1f, 1f)] public float Valence;
        [Range(0f, 1f)] public float Arousal;
        [Range(0f, 1f)] public float Confidence;
    }

    // -------------------------------------------------------------------------
    [Serializable]
    public struct StimulusEvent
    {
        public string TrackableId;
        public string TrackableName;
        public StimulusType StimulusType;
        public StimulusPhase Phase;
        public double Time;
        public EmotionSample Emotion;
        public int CheckpointIndex;
        public string FeatureName;   // ex. "volume"
        public float FeatureValue;   // ex. 0.78f
    }

    // -------------------------------------------------------------------------
    [AddComponentMenu("Emotion-Driven/Emotion Manager (Singleton)")]
    public class EmotionManager : MonoBehaviour
    {
        public static EmotionManager Instance { get; private set; }

        [SerializeField] private EmotionSample _latest;
        public EmotionSample Latest => _latest;
        public bool HasSample { get; private set; }

        [Header("Passive Logging (no stimulus)")]
        public bool passiveLoggingEnabled = false;

        private List<EmotionSample> _passiveLog = new();

        public event Action<StimulusEvent> OnStimulus;
        public event Action<EmotionSample> OnEmotionUpdated;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void OnDestroy()
        {
            if (Instance != this) return;
            EmotionLogger.EndSession();
            Instance = null;
        }

        private void Update() => EmotionLogger.FlushBatchIfDue();

        public void UpdateEmotion(EmotionSample sample)
        {
            if (string.IsNullOrEmpty(sample.Source)) sample.Source = "Adapter";
            HasSample = true;
            _latest = sample;
            OnEmotionUpdated?.Invoke(sample);

            if (passiveLoggingEnabled)
                _passiveLog.Add(sample);
        }

        internal void ClearInput(string source)
        {
            if (_latest.Source == source) HasSample = false;
        }

        internal void RaiseStimulus(StimulusEvent evt)
        {
            OnStimulus?.Invoke(evt);
            EmotionEvents.Raise(evt);
        }

        /// <summary>Returns all passively logged emotion samples.</summary>
        public List<EmotionSample> GetPassiveLog() => new(_passiveLog);

        /// <summary>Clears the passive log.</summary>
        public void ClearPassiveLog() => _passiveLog.Clear();
    }
}
