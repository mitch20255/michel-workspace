package com.michel.zoomrecorder

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.michel.zoomrecorder.ui.ZoomRecorderApp
import com.michel.zoomrecorder.ui.theme.ZoomRecorderTheme

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* Compose recomposes against the live permission state on next interaction. */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestNeededPermissions()
        setContent {
            ZoomRecorderTheme {
                ZoomRecorderApp(onRequestPermissions = ::requestNeededPermissions)
            }
        }
    }

    private fun requestNeededPermissions() {
        val needed = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            needed += Manifest.permission.POST_NOTIFICATIONS
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }
}
