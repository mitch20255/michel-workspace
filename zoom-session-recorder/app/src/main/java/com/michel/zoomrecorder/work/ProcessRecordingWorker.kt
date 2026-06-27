package com.michel.zoomrecorder.work

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.michel.zoomrecorder.R
import com.michel.zoomrecorder.data.SecurePrefs
import com.michel.zoomrecorder.data.SessionRepository
import com.michel.zoomrecorder.data.SessionStatus
import com.michel.zoomrecorder.network.ClaudeApi
import com.michel.zoomrecorder.network.WhisperApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Runs after a recording stops: transcribe with Whisper, then summarize with Claude. */
class ProcessRecordingWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val sessionId = inputData.getString(KEY_SESSION_ID) ?: return Result.failure()
        val repo = SessionRepository.getInstance(applicationContext)
        val prefs = SecurePrefs(applicationContext)
        val session = repo.get(sessionId) ?: return Result.failure()

        val openAiKey = prefs.openAiApiKey
        val anthropicKey = prefs.anthropicApiKey
        if (openAiKey.isNullOrBlank() || anthropicKey.isNullOrBlank()) {
            repo.upsert(
                session.copy(
                    status = SessionStatus.FAILED,
                    errorMessage = "Clés API manquantes. Va dans Réglages pour les ajouter.",
                )
            )
            return Result.failure()
        }

        return withContext(Dispatchers.IO) {
            try {
                repo.upsert(session.copy(status = SessionStatus.TRANSCRIBING))
                val transcript = WhisperApi(openAiKey).transcribe(File(session.audioFilePath))
                repo.upsert(session.copy(status = SessionStatus.SUMMARIZING, transcript = transcript))

                val model = prefs.claudeModel ?: SecurePrefs.DEFAULT_MODEL
                val summary = ClaudeApi(anthropicKey).summarize(transcript, session.title, model)
                repo.upsert(
                    session.copy(
                        status = SessionStatus.DONE,
                        transcript = transcript,
                        summary = summary,
                    )
                )
                notifyDone(session.title, success = true)
                Result.success()
            } catch (e: Exception) {
                repo.upsert(session.copy(status = SessionStatus.FAILED, errorMessage = e.message))
                notifyDone(session.title, success = false)
                Result.failure()
            }
        }
    }

    private fun notifyDone(title: String, success: Boolean) {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Résumés", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
        val text = if (success) "Résumé prêt pour \"$title\"" else "Échec du traitement pour \"$title\""
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle("Zoom Session Recorder")
            .setContentText(text)
            .setAutoCancel(true)
            .build()
        manager.notify(text.hashCode(), notification)
    }

    companion object {
        const val KEY_SESSION_ID = "session_id"
        private const val CHANNEL_ID = "summary_channel"
    }
}
