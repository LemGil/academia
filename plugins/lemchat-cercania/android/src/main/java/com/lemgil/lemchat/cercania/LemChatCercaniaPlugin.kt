package com.lemgil.lemchat.cercania

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Puente Capacitor ↔ Nearby Connections para LemChat (Fase B).
 * La capa web (src/lemchat/cercania.ts) lo llama por su nombre,
 * «LemChatCercania». Los permisos se piden aquí, según la versión de
 * Android — la guía de activación de la app ya le dijo al estudiante
 * para qué son (diseño §4: activación voluntaria e informada).
 */
@CapacitorPlugin(name = "LemChatCercania")
class LemChatCercaniaPlugin : Plugin() {

    private lateinit var manager: CercaniaManager
    private var llamadaPendiente: PluginCall? = null
    private var nombrePendiente: String = "LemChat"

    override fun load() {
        manager = CercaniaManager(context.applicationContext) { evento, datos ->
            val obj = JSObject()
            for ((clave, valor) in datos) {
                when (valor) {
                    is String -> obj.put(clave, valor)
                    is Boolean -> obj.put(clave, valor)
                    is Number -> obj.put(clave, valor)
                }
            }
            notifyListeners(evento, obj)
        }
    }

    // ------------------------------------------------------------ permisos

    private fun permisosNecesarios(): Array<String> {
        val lista = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            lista += Manifest.permission.BLUETOOTH_SCAN
            lista += Manifest.permission.BLUETOOTH_ADVERTISE
            lista += Manifest.permission.BLUETOOTH_CONNECT
        } else {
            lista += Manifest.permission.BLUETOOTH
            lista += Manifest.permission.BLUETOOTH_ADMIN
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            lista += Manifest.permission.NEARBY_WIFI_DEVICES
        } else {
            // Hasta Android 12, descubrir por Bluetooth exige ubicación.
            lista += Manifest.permission.ACCESS_FINE_LOCATION
        }
        return lista.toTypedArray()
    }

    private fun faltanPermisos(): List<String> =
        permisosNecesarios().filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }

    private fun pedirPermisos(call: PluginCall, nombre: String) {
        llamadaPendiente = call
        nombrePendiente = nombre
        ActivityCompat.requestPermissions(activity, faltanPermisos().toTypedArray(), CODIGO_PERMISOS)
    }

    override fun handleRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray,
    ) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != CODIGO_PERMISOS) return
        val call = llamadaPendiente ?: return
        llamadaPendiente = null
        if (faltanPermisos().isEmpty()) {
            arrancarDeVerdad(call, nombrePendiente)
        } else {
            call.reject("LemChat necesita los permisos de cercanía (Bluetooth y Wi-Fi cercano) para buscar teléfonos al lado tuyo. Sin ellos, solo funciona el buzón por internet.")
        }
    }

    // ------------------------------------------------------------ métodos

    private fun arrancarDeVerdad(call: PluginCall, nombre: String) {
        manager.iniciar(nombre)
        CercaniaService.arrancar(context)
        call.resolve(JSObject().put("activo", true))
    }

    @PluginMethod
    fun iniciar(call: PluginCall) {
        val nombre = call.getString("nombre") ?: "LemChat"
        if (faltanPermisos().isEmpty()) {
            arrancarDeVerdad(call, nombre)
        } else {
            pedirPermisos(call, nombre)
        }
    }

    @PluginMethod
    fun detener(call: PluginCall) {
        manager.detener()
        CercaniaService.parar(context)
        call.resolve()
    }

    @PluginMethod
    fun reiniciar(call: PluginCall) {
        val nombre = call.getString("nombre") ?: "LemChat"
        if (faltanPermisos().isEmpty()) {
            manager.reiniciar(nombre)
            CercaniaService.arrancar(context)
            call.resolve(JSObject().put("activo", true))
        } else {
            pedirPermisos(call, nombre)
        }
    }

    @PluginMethod
    fun enviar(call: PluginCall) {
        val endpointId = call.getString("endpointId")
        val datos = call.getString("datos")
        if (endpointId == null || datos == null) {
            call.reject("enviar necesita endpointId y datos")
            return
        }
        try {
            manager.enviar(endpointId, datos)
            call.resolve()
        } catch (e: Exception) {
            call.reject("No se pudo enviar por cercanía: ${e.message}")
        }
    }

    companion object {
        private const val CODIGO_PERMISOS = 7711
    }
}
