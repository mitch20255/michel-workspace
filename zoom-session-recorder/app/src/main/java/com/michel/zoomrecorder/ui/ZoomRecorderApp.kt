package com.michel.zoomrecorder.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument

@Composable
fun ZoomRecorderApp(onRequestPermissions: () -> Unit) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "home") {
        composable("home") {
            HomeScreen(
                onOpenSettings = { navController.navigate("settings") },
                onOpenSession = { id -> navController.navigate("session/$id") },
                onRequestPermissions = onRequestPermissions,
            )
        }
        composable("settings") {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
        composable(
            route = "session/{id}",
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id").orEmpty()
            SessionDetailScreen(sessionId = id, onBack = { navController.popBackStack() })
        }
    }
}
