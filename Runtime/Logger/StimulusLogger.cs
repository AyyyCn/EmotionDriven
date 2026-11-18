using UnityEngine;
using EmotionDriven;

public class StimulusLogger : MonoBehaviour
{
    void OnEnable()  => EmotionEvents.Any += Log;
    void OnDisable() => EmotionEvents.Any -= Log;

    void Log(StimulusEvent e)
    {
        string reading = e.Emotion.Source == "No input" ? "No input" : e.Emotion.Label.ToString();
        if (!e.Emotion.LabelOnly && e.Emotion.Source != "No input")
            reading += $" ({e.Emotion.Confidence:P0})";
        Debug.Log($"[{e.Time:F2}] {e.TrackableId} {e.StimulusType}/{e.Phase} → {reading}");
    }
}
