using System;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace EmotionDriven
{
    [AddComponentMenu("Emotion-Driven/Camera Emotion Receiver (TCP)")]
    public sealed class CameraEmotionReceiver : MonoBehaviour
    {
        public string host = "127.0.0.1";
        [Range(1, 65535)] public int port = 9999;
        private CancellationTokenSource lifetime;
        private TcpClient client;
        private const string Source = "Camera TCP";

        private void OnEnable()
        {
            lifetime = new CancellationTokenSource();
            _ = ReceiveAsync(lifetime.Token);
        }

        private void OnDisable()
        {
            lifetime.Cancel();
            client?.Dispose();
            client = null;
            lifetime.Dispose();
            EmotionManager.Instance?.ClearInput(Source);
        }

        private async Task ReceiveAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                using (var connection = new TcpClient())
                {
                    client = connection;
                    try
                    {
                        await connection.ConnectAsync(host, port);
                        await ReadLabelsAsync(connection.GetStream(), token, label =>
                        {
                            if (label.HasValue)
                                EmotionManager.Instance?.UpdateEmotion(new EmotionSample {
                                    Time = Time.timeAsDouble, Label = label.Value, Source = Source, LabelOnly = true
                                });
                            else
                                EmotionManager.Instance?.ClearInput(Source);
                        });
                    }
                    catch (Exception ex) when (ex is SocketException || ex is IOException || ex is ObjectDisposedException)
                    {
                        // The camera app can start later or restart during a playtest.
                    }
                }
                if (token.IsCancellationRequested) return;
                client = null;
                EmotionManager.Instance?.ClearInput(Source);
                try { await Task.Delay(1500, token); }
                catch (OperationCanceledException) { return; }
            }
        }

        internal static async Task ReadLabelsAsync(Stream stream, CancellationToken token, Action<EmotionLabel?> onLabel)
        {
            using var reader = new StreamReader(stream);
            while (!token.IsCancellationRequested)
            {
                string line = await reader.ReadLineAsync();
                if (line == null || token.IsCancellationRequested) return;
                onLabel(TryParseLabel(line, out var label) ? label : (EmotionLabel?)null);
            }
        }

        private static bool TryParseLabel(string text, out EmotionLabel label)
        {
            switch (text.Trim().ToLowerInvariant())
            {
                case "neutral": label = EmotionLabel.Neutral; return true;
                case "happiness": case "happy": label = EmotionLabel.Happy; return true;
                case "sadness": case "sad": label = EmotionLabel.Sad; return true;
                case "anger": case "angry": label = EmotionLabel.Angry; return true;
                case "fear": label = EmotionLabel.Fear; return true;
                case "surprise": case "surprised": label = EmotionLabel.Surprise; return true;
                case "disgust": label = EmotionLabel.Disgust; return true;
                case "contempt": label = EmotionLabel.Contempt; return true;
                default: label = default; return false;
            }
        }
    }
}
