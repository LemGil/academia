package com.lemgil.lemchat.cercania

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Servicio en primer plano que mantiene vivo el proceso mientras CHAT
 * está activo, para que la escucha de cercanía no muera con la pantalla
 * apagada. Es visible y honesto: notificación permanente «LemChat está
 * escuchando» mientras corre. El trabajo de radio lo hace
 * [CercaniaManager] en el mismo proceso.
 */
class CercaniaService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val canalId = "lemchat-cercania"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val canal = NotificationChannel(
                canalId,
                "LemChat — cercanía",
                NotificationManager.IMPORTANCE_LOW,
            )
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(canal)
        }
        val notificacion: Notification = NotificationCompat.Builder(this, canalId)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("LemChat está escuchando")
            .setContentText("Cercanía Wi-Fi activa: puede recibir avisos y enseñanzas cerca de ti.")
            .setOngoing(true)
            .build()
        try {
            startForeground(ID_NOTIFICACION, notificacion)
        } catch (_: Exception) {
            // En algún fabricante el primer plano puede fallar; la escucha
            // en proceso sigue mientras la app esté abierta.
        }
        return START_STICKY
    }

    companion object {
        private const val ID_NOTIFICACION = 7712

        fun arrancar(context: Context) {
            try {
                ContextCompat.startForegroundService(
                    context,
                    Intent(context, CercaniaService::class.java),
                )
            } catch (_: Exception) {
                // Sin servicio, la cercanía vive mientras la app esté en uso.
            }
        }

        fun parar(context: Context) {
            try {
                context.stopService(Intent(context, CercaniaService::class.java))
            } catch (_: Exception) {
                // Ya estaba parado.
            }
        }
    }
}
