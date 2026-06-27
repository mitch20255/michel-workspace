package com.michel.zoomrecorder.recording

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.michel.zoomrecorder.MainActivity
import com.michel.zoomrecorder.R
import com.michel.zoomrecorder.data.Session
import com.michel.zoomrecorder.data.SessionRepository
import com.michel.zoomrecorder.data.SessionStatus
import com.michel.zoomrecorder.work.ProcessRecordingWorker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Records microphone audio in the foreground while the user has Zoom on speaker.
 * Android blocks third-party apps from capturing another app's VoIP audio stream
 * directly (AudioPlaybackCapture excludes USAGE_VOICE_COMMUNICATION), so the
 * microphone is the only reliable, permission-friendly way to capture a call.
 */
class RecordingService : Service() {

    private var recorder: MediaRecorder? = null
    private var currentSessionId: String? = null
    private var currentFile: File? = null
    private var startedAt: Long = 0L

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startRecording()
            ACTION_STOP -> stopRecording()
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startRecording() {
        if (recorder != null) return

        val dir = File(filesDir, "recordings").apply { mkdirs() }
        val timestamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.getDefault()).format(Date())
        val file = File(dir, "session_$timestamp.m4a")
        currentFile = file
        currentSessionId = UUID.randomUUID().toString()
        startedAt = System.currentTimeMillis()

        startForeground(NOTIFICATION_ID, buildNotification())

        recorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioEncodingBitRate(128_000)
            setAudioSamplingRate(44_100)
            setOutputFile(file.absolutePath)
            prepare()
            start()
        }
        _isRecording.value = true
    }

    private fun stopRecording() {
        val activeRecorder = recorder
        if (activeRecorder == null) {
            stopSelf()
            return
        }
        runCatching {
            activeRecorder.stop()
            activeRecorder.release()
        }
        recorder = null
        _isRecording.value = false

        val file = currentFile
        val sessionId = currentSessionId
        if (file != null && sessionId != null) {
            val durationMs = System.currentTimeMillis() - startedAt
            val title = "Session du " +
                SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(Date(startedAt))
            val session = Session(
                id = sessionId,
                title = title,
                createdAt = startedAt,
                audioFilePath = file.absolutePath,
                durationMs = durationMs,
                status = SessionStatus.RECORDED,
            )
            SessionRepository.getInstance(applicationContext).upsert(session)
            enqueueProcessing(sessionId)
        }

        currentFile = null
        currentSessionId = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun enqueueProcessing(sessionId: String) {
        val request = OneTimeWorkRequestBuilder<ProcessRecordingWorker>()
            .setInputData(
                Data.Builder().putString(ProcessRecordingWorker.KEY_SESSION_ID, sessionId).build()
            )
            .build()
        WorkManager.getInstance(applicationContext).enqueue(request)
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Enregistrement", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle("Enregistrement en cours")
            .setContentText("Appuie pour revenir à l'app")
            .setContentIntent(openIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        runCatching {
            recorder?.stop()
            recorder?.release()
        }
        recorder = null
        super.onDestroy()
    }

    companion object {
        const val ACTION_START = "com.michel.zoomrecorder.action.START"
        const val ACTION_STOP = "com.michel.zoomrecorder.action.STOP"
        private const val CHANNEL_ID = "recording_channel"
        private const val NOTIFICATION_ID = 1001

        private val _isRecording = MutableStateFlow(false)
        val isRecording: StateFlow<Boolean> = _isRecording

        fun start(context: Context) {
            val intent = Intent(context, RecordingService::class.java).setAction(ACTION_START)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.startService(Intent(context, RecordingService::class.java).setAction(ACTION_STOP))
        }
    }
}
