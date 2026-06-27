package com.michel.zoomrecorder.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Blue = Color(0xFF1E88E5)
private val BlueDark = Color(0xFF90CAF9)

private val LightColors = lightColorScheme(primary = Blue, secondary = Blue)
private val DarkColors = darkColorScheme(primary = BlueDark, secondary = BlueDark)

@Composable
fun ZoomRecorderTheme(darkTheme: Boolean = androidx.compose.foundation.isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
