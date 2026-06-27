package com.michel.zoomrecorder.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.michel.zoomrecorder.data.SecurePrefs

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { SecurePrefs(context) }
    var openAiKey by remember { mutableStateOf(prefs.openAiApiKey.orEmpty()) }
    var anthropicKey by remember { mutableStateOf(prefs.anthropicApiKey.orEmpty()) }
    var model by remember { mutableStateOf(prefs.claudeModel ?: SecurePrefs.DEFAULT_MODEL) }
    var saved by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Réglages") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Text("Clé API OpenAI (transcription Whisper)", style = MaterialTheme.typography.labelLarge)
            OutlinedTextField(
                value = openAiKey,
                onValueChange = { openAiKey = it; saved = false },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))
            Text("Clé API Anthropic (résumé Claude)", style = MaterialTheme.typography.labelLarge)
            OutlinedTextField(
                value = anthropicKey,
                onValueChange = { anthropicKey = it; saved = false },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))
            Text("Modèle Claude", style = MaterialTheme.typography.labelLarge)
            OutlinedTextField(
                value = model,
                onValueChange = { model = it; saved = false },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))
            Button(onClick = {
                prefs.openAiApiKey = openAiKey
                prefs.anthropicApiKey = anthropicKey
                prefs.claudeModel = model
                saved = true
            }) {
                Text("Enregistrer")
            }
            if (saved) {
                Spacer(Modifier.height(8.dp))
                Text("Réglages enregistrés.", color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
