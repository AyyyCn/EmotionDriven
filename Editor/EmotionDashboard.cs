using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace EmotionDriven
{
    internal static class EmotionDashboard
    {
        // Resolve the shipped HTML even if the toolkit is installed under a different Assets folder.
        private static string DashboardPath => Path.GetFullPath(AssetDatabase.GUIDToAssetPath("0f515441db324751a37af729957bdda4"));

        [MenuItem("Tools/Emotion-Driven/Analytics Dashboard")]
        public static void Open() => Application.OpenURL(new Uri(DashboardPath).AbsoluteUri);

        public static void OpenRecording(string path)
        {
            // Keep the snapshot local. Base64 isolates arbitrary recorded strings from HTML.
            string template = File.ReadAllText(DashboardPath);
            string encoded = Convert.ToBase64String(File.ReadAllBytes(path));
            string html = template.Replace("<!--recording-->", "<script id=\"recording\" type=\"application/octet-stream\">" + encoded + "</script>");
            string output = Path.Combine(Application.temporaryCachePath, "EmotionDriven-report.html");
            File.WriteAllText(output, html);
            Application.OpenURL(new Uri(output).AbsoluteUri + "#sessions");
        }
    }
}
