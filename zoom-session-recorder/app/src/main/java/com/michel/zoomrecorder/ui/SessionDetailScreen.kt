package com.michel.zoomrecorder.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.michel.zoomrecorder.data.SessionRepository
import com.michel.zoomrecorder.data.SessionStatus

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionDetailScreen(sessionId: String, onBack: () -> Unit) {
    val context = LocalContext.current
    val repository = remember { SessionRepository.getInstance(context) }
    val sessions by repository.sessions.collectAsState()
    val session = sessions.firstOrNull { it.id == sessionId }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(session?.title ?: "Session") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
            )
        }
    ) { padding ->
        if (session == null) {
            Box(Modifier.fillMaxSize().padding(padding)) { Text("Session introuvable") }
            return@Scaffold
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            when (session.status) {
                SessionStatus.RECORDED, SessionStatus.TRANSCRIBING, SessionStatus.SUMMARIZING -> {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(12.dp))
                        Text(
                            when (session.status) {
                                SessionStatus.RECORDED -> "En attente de traitement…"
                                SessionStatus.TRANSCRIBING -> "Transcription en cours…"
                                else -> "Génération du résumé…"
                            }
                        )
                    }
                }
                SessionStatus.FAILED -> {
                    Text(
                        "Erreur : ${session.errorMessage ?: "inconnue"}",
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                SessionStatus.DONE -> {
                    Text("Résumé", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(session.summary.orEmpty())
                    Spacer(Modifier.height(24.dp))
                    Text("Transcription complète", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(session.transcript.orEmpty())
                }
            }
        }
    }
}
