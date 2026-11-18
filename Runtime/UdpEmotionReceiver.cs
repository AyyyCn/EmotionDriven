using UnityEngine;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using EmotionDriven;
using System;
using System.Collections.Concurrent;

public class UdpEmotionReceiver : MonoBehaviour
{
    public int port = 5066; // Default port, can be changed in the inspector
    private UdpClient udpClient;
    private Thread receiveThread;
    private ConcurrentQueue<EmotionSample> emotionQueue = new ConcurrentQueue<EmotionSample>();
    private volatile bool running = false;

    void Start()
    {
        // Close previous client just in case
        Cleanup();

        udpClient = new UdpClient(port);
        running = true;
        receiveThread = new Thread(ReceiveData);
        receiveThread.IsBackground = true;
        receiveThread.Start();
    }

    void Update()
    {
        while (emotionQueue.TryDequeue(out EmotionSample sample))
        {
            sample.Time = Time.timeAsDouble;
            EmotionManager.Instance?.UpdateEmotion(sample);
        }
    }

    void ReceiveData()
    {
        IPEndPoint remoteEP = new IPEndPoint(IPAddress.Any, 0);
        while (running)
        {
            try
            {
                byte[] data = udpClient.Receive(ref remoteEP);
                string json = Encoding.UTF8.GetString(data);
                var payload = new EmotionData();
                JsonUtility.FromJsonOverwrite(json, payload);
                if (!Enum.IsDefined(typeof(EmotionLabel), payload.label) ||
                    !(payload.valence >= -1 && payload.valence <= 1 &&
                      payload.arousal >= 0 && payload.arousal <= 1 &&
                      payload.confidence >= 0 && payload.confidence <= 1))
                    continue;

                EmotionSample sample = new EmotionSample
                {
                    Label = (EmotionLabel)payload.label,
                    Source = "UDP",
                    Valence = payload.valence,
                    Arousal = payload.arousal,
                    Confidence = payload.confidence
                };

                emotionQueue.Enqueue(sample);
            }
            catch (Exception e)
            {
                if (running) // Avoid log spam on quit
                    Debug.LogError("UDP Error: " + e.Message);
            }
        }
    }

    void OnDestroy()
    {
        Cleanup();
    }

    void OnApplicationQuit()
    {
        Cleanup();
    }

    private void Cleanup()
    {
        running = false;

        try { udpClient?.Close(); } catch { }
        udpClient = null;

        try { receiveThread?.Join(100); } catch { }
        receiveThread = null;
    }

    [Serializable]
    public class EmotionData
    {
        public int label = -1;
        public float valence = float.NaN;
        public float arousal = float.NaN;
        public float confidence = float.NaN;
    }
}
