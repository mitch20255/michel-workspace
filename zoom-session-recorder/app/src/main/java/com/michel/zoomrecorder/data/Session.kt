package com.michel.zoomrecorder.data

enum class SessionStatus {
    RECORDED,
    TRANSCRIBING,
    SUMMARIZING,
    DONE,
    FAILED,
}

data class Session(
    val id: String,
    val title: String,
    val createdAt: Long,
    val audioFilePath: String,
    val durationMs: Long = 0L,
    val status: SessionStatus = SessionStatus.RECORDED,
    val transcript: String? = null,
    val summary: String? = null,
    val errorMessage: String? = null,
)
