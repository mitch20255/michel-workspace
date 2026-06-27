package com.michel.zoomrecorder.data

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/** Stores recording sessions as a single JSON file under the app's private storage. */
class SessionRepository private constructor(context: Context) {
    private val gson = Gson()
    private val storeFile = File(context.filesDir, "sessions.json")

    private val _sessions = MutableStateFlow(loadFromDisk())
    val sessions: StateFlow<List<Session>> = _sessions

    @Synchronized
    private fun loadFromDisk(): List<Session> {
        if (!storeFile.exists()) return emptyList()
        return runCatching {
            val type = object : TypeToken<List<Session>>() {}.type
            gson.fromJson<List<Session>>(storeFile.readText(), type) ?: emptyList()
        }.getOrDefault(emptyList())
    }

    @Synchronized
    private fun persist(sessions: List<Session>) {
        storeFile.writeText(gson.toJson(sessions))
        _sessions.value = sessions
    }

    fun upsert(session: Session) {
        val current = _sessions.value.toMutableList()
        val index = current.indexOfFirst { it.id == session.id }
        if (index >= 0) current[index] = session else current.add(0, session)
        persist(current)
    }

    fun get(id: String): Session? = _sessions.value.firstOrNull { it.id == id }

    fun delete(id: String) {
        persist(_sessions.value.filterNot { it.id == id })
    }

    companion object {
        @Volatile private var instance: SessionRepository? = null

        fun getInstance(context: Context): SessionRepository =
            instance ?: synchronized(this) {
                instance ?: SessionRepository(context.applicationContext).also { instance = it }
            }
    }
}
