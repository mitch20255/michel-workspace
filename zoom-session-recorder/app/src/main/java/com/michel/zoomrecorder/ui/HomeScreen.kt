package com.michel.zoomrecorder.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.michel.zoomrecorder.data.Session
import com.michel.zoomrecorder.data.SessionRepository
import com.michel.zoomrecorder.data.SessionStatus
import com.michel.zoomrecorder.recording.RecordingService

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenSettings: () -> Unit,
    onOpenSession: (String) -> Unit,
    onRequestPermissions: () -> Unit,
) {
    val context = LocalContext.current
    val repository = remember { SessionRepository.getInstance(context) }
    val sessions by repository.sessions.collectAsState()
    val isRecording by RecordingService.isRecording.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Zoom Session Recorder") },
                actions = {
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Filled.Settings, contentDescription = "Réglages")
                    }
                },
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Box(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Button(
                    onClick = {
                        val hasMic = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.RECORD_AUDIO,
                        ) == PackageManager.PERMISSION_GRANTED
                        if (!hasMic) {
                            onRequestPermissions()
                            return@Button
                        }
                        if (isRecording) {
                            RecordingService.stop(context)
                        } else {
                            RecordingService.start(context)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isRecording) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.primary
                        }
                    ),
                ) {
                    Icon(if (isRecording) Icons.Filled.Stop else Icons.Filled.Mic, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (isRecording) "Arrêter l'enregistrement" else "Démarrer l'enregistrement")
                }
            }

            if (isRecording) {
                Text(
                    "Enregistrement en cours… mets Zoom en haut-parleur.",
                    modifier = Modifier.padding(horizontal = 24.dp),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(8.dp))
            }

            HorizontalDivider()

            if (sessions.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Aucune session enregistrée pour l'instant.")
                }
            } else {
                LazyColumn {
                    items(sessions, key = { it.id }) { session ->
                        SessionRow(session = session, onClick = { onOpenSession(session.id) })
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}

@Composable
private fun SessionRow(session: Session, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(session.title) },
        supportingContent = { Text(statusLabel(session.status)) },
        modifier = Modifier.clickable(onClick = onClick),
    )
}

private fun statusLabel(status: SessionStatus): String = when (status) {
    SessionStatus.RECORDED -> "En attente de traitement"
    SessionStatus.TRANSCRIBING -> "Transcription en cours…"
    SessionStatus.SUMMARIZING -> "Génération du résumé…"
    SessionStatus.DONE -> "Résumé prêt"
    SessionStatus.FAILED -> "Échec du traitement"
}
