package com.michel.zoomrecorder.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** API keys and settings, encrypted at rest via the Android Keystore. */
class SecurePrefs(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var openAiApiKey: String?
        get() = prefs.getString(KEY_OPENAI, null)
        set(value) = prefs.edit().putString(KEY_OPENAI, value).apply()

    var anthropicApiKey: String?
        get() = prefs.getString(KEY_ANTHROPIC, null)
        set(value) = prefs.edit().putString(KEY_ANTHROPIC, value).apply()

    var claudeModel: String?
        get() = prefs.getString(KEY_MODEL, DEFAULT_MODEL)
        set(value) = prefs.edit().putString(KEY_MODEL, value).apply()

    companion object {
        private const val KEY_OPENAI = "openai_api_key"
        private const val KEY_ANTHROPIC = "anthropic_api_key"
        private const val KEY_MODEL = "claude_model"
        const val DEFAULT_MODEL = "claude-sonnet-4-6"
    }
}
