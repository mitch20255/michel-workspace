package com.michel.zoomrecorder.network

import com.google.gson.JsonParser
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Speech-to-text via OpenAI's Whisper transcription endpoint. */
class WhisperApi(private val apiKey: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.MINUTES)
        .writeTimeout(5, TimeUnit.MINUTES)
        .build()

    fun transcribe(audioFile: File): String {
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("model", "whisper-1")
            .addFormDataPart(
                "file",
                audioFile.name,
                audioFile.asRequestBody("audio/m4a".toMediaType()),
            )
            .build()

        val request = Request.Builder()
            .url("https://api.openai.com/v1/audio/transcriptions")
            .addHeader("Authorization", "Bearer $apiKey")
            .post(body)
            .build()

        client.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("Whisper API error (${response.code}): $responseBody")
            }
            return JsonParser.parseString(responseBody).asJsonObject.get("text").asString
        }
    }
}
