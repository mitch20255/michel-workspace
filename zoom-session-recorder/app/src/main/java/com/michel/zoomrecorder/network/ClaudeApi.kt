package com.michel.zoomrecorder.network

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Long-form meeting summary via the Anthropic Messages API. */
class ClaudeApi(private val apiKey: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.MINUTES)
        .build()

    fun summarize(transcript: String, sessionTitle: String, model: String): String {
        val prompt = """
            Tu vas recevoir la transcription d'une session Zoom intitulée "$sessionTitle".
            Rédige un résumé long et structuré en français, avec ces sections :
            - Sujets principaux abordés
            - Décisions prises
            - Actions à faire (avec responsable si mentionné)
            - Points en suspens ou questions ouvertes

            Transcription :
            $transcript
        """.trimIndent()

        val messages = JsonArray().apply {
            add(
                JsonObject().apply {
                    addProperty("role", "user")
                    addProperty("content", prompt)
                }
            )
        }

        val payload = JsonObject().apply {
            addProperty("model", model)
            addProperty("max_tokens", 4096)
            add("messages", messages)
        }

        val request = Request.Builder()
            .url("https://api.anthropic.com/v1/messages")
            .addHeader("x-api-key", apiKey)
            .addHeader("anthropic-version", "2023-06-01")
            .addHeader("content-type", "application/json")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("Claude API error (${response.code}): $responseBody")
            }
            val json = JsonParser.parseString(responseBody).asJsonObject
            return json.getAsJsonArray("content")
                .joinToString("\n") { it.asJsonObject.get("text").asString }
        }
    }
}
