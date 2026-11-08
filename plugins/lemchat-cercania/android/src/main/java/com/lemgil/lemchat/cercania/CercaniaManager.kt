package com.lemgil.lemchat.cercania

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap

/**
 * Núcleo de cercanía con Nearby Connections (estrategia P2P_CLUSTER:
 * todos anuncian y todos descubren; Bluetooth encuentra, Wi-Fi mueve).
 *
 * Lecciones de la Fase A aplicadas aquí:
 *  - Si anunciar/descubrir falla, un vigilante reintenta solo con espera
 *    creciente (nada de «contador en 0 para siempre»).
 *  - Los paquetes grandes (una enseñanza pesa más que el máximo de un
 *    payload de bytes, ~32 KB) viajan troceados y se reensamblan aquí:
 *    la capa web siempre ve mensajes completos.
 *  - Las conexiones se aceptan automáticamente: la confianza no vive en
 *    la radio — todo lo sensible va cifrado o firmado en la capa LemChat.
 *
 * Frenos de la v1.5.3 (la tormenta que congelaba la app con 3 teléfonos):
 *  - Memoria por endpoint: si ya está conectado o conectando, un nuevo
 *    «encontrado» se ignora — Nearby re-reporta al mismo teléfono sin
 *    parar y cada reporte era otra petición de conexión.
 *  - Desempate anti-colisión: de cada pareja solo inicia el lado con el
 *    nombre «menor»; el otro espera la invitación y acepta. Antes los
 *    dos iniciaban a la vez y colisionaban en cadena.
 *  - Enfriamiento: tras un fallo o una caída, 20 s sin reintentar con
 *    ese endpoint. El ciclo conectar→caer→reconectar ya no es continuo.
 *  - Arranque sin duplicar: anunciar/descubrir llevan bandera de
 *    «corriendo»; el vigilante solo relanza lo que de verdad cayó.
 */
class CercaniaManager(
    private val context: Context,
    private val emitir: (evento: String, datos: Map<String, Any?>) -> Unit,
) {
    companion object {
        const val SERVICE_ID = "com.lemgil.academia.lemchat"
        private const val TROZO = 28_000
        private const val ESPERA_MIN_MS = 5_000L
        private const val ESPERA_MAX_MS = 30_000L
        private const val ENFRIAMIENTO_MS = 20_000L
    }

    private val cliente by lazy { Nearby.getConnectionsClient(context) }
    private val handler = Handler(Looper.getMainLooper())

    @Volatile
    var activo = false
        private set

    @Volatile
    private var nombreLocal: String = "LemChat"

    @Volatile
    private var esperaReintento = ESPERA_MIN_MS

    private val conectados = ConcurrentHashMap.newKeySet<String>()
    private val conectando = ConcurrentHashMap.newKeySet<String>()
    private val enfriamientoHasta = ConcurrentHashMap<String, Long>()

    @Volatile
    private var anunciando = false

    @Volatile
    private var descubriendo = false

    private val troceados = ConcurrentHashMap<String, MutableMap<Int, ByteArray>>()
    private val totales = ConcurrentHashMap<String, Int>()

    fun iniciar(nombre: String) {
        nombreLocal = nombre
        activo = true
        arrancar()
    }

    fun detener() {
        activo = false
        handler.removeCallbacksAndMessages(null)
        try {
            cliente.stopAdvertising()
            cliente.stopDiscovery()
            cliente.stopAllEndpoints()
        } catch (_: Exception) {
            // Si Nearby ya estaba caído, detener no debe tumbar la app.
        }
        conectados.clear()
        conectando.clear()
        enfriamientoHasta.clear()
        anunciando = false
        descubriendo = false
    }

    fun reiniciar(nombre: String) {
        detener()
        iniciar(nombre)
    }

    /** Envía un texto (JSON de la capa LemChat) a un endpoint conectado. */
    fun enviar(endpointId: String, datos: String) {
        val bytes = datos.toByteArray(StandardCharsets.UTF_8)
        for (marco in trocear(bytes)) {
            cliente.sendPayload(endpointId, Payload.fromBytes(marco))
        }
    }

    // ------------------------------------------------------------ arranque

    private fun arrancar() {
        if (!activo) return
        val estrategia = Strategy.P2P_CLUSTER
        if (!anunciando) {
            cliente.startAdvertising(
                nombreLocal,
                SERVICE_ID,
                cicloDeVida,
                AdvertisingOptions.Builder().setStrategy(estrategia).build(),
            ).addOnSuccessListener {
                anunciando = true
                esperaReintento = ESPERA_MIN_MS
            }.addOnFailureListener {
                anunciando = false
                programarReintento()
            }
        }
        if (!descubriendo) {
            cliente.startDiscovery(
                SERVICE_ID,
                descubrimiento,
                DiscoveryOptions.Builder().setStrategy(estrategia).build(),
            ).addOnSuccessListener {
                descubriendo = true
                esperaReintento = ESPERA_MIN_MS
            }.addOnFailureListener {
                descubriendo = false
                programarReintento()
            }
        }
    }

    /** El vigilante: si la escucha se atasca o cae, vuelve sola. */
    private fun programarReintento() {
        if (!activo) return
        val espera = esperaReintento
        esperaReintento = (esperaReintento * 2).coerceAtMost(ESPERA_MAX_MS)
        handler.postDelayed({ arrancar() }, espera)
    }

    // ------------------------------------------------------------ callbacks

    private val descubrimiento = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            emitir("descubierto", mapOf("endpointId" to endpointId, "nombre" to info.endpointName))
            // Conexión automática: la confianza vive en la capa de LemChat
            // (cifrado y firmas), no en emparejar radios a mano. Pero con
            // memoria, desempate y enfriamiento (intentarConectar).
            intentarConectar(endpointId, info.endpointName, forzar = false)
        }

        override fun onEndpointLost(endpointId: String) {
            conectando.remove(endpointId)
            emitir("perdido", mapOf("endpointId" to endpointId))
        }
    }

    /**
     * Pide la conexión con frenos: ignora si ya está conectado o
     * conectando, respeta el enfriamiento tras un fallo/caída, y solo
     * inicia el lado «menor» de la pareja (desempate anti-colisión).
     * Con nombres iguales, `forzar` permite un intento tras la espera
     * corta para no quedar los dos esperando para siempre.
     */
    private fun intentarConectar(endpointId: String, nombreRemoto: String, forzar: Boolean) {
        if (!activo) return
        if (conectados.contains(endpointId) || conectando.contains(endpointId)) return
        if (System.currentTimeMillis() < (enfriamientoHasta[endpointId] ?: 0L)) return
        if (!forzar) {
            val comparacion = nombreLocal.compareTo(nombreRemoto)
            if (comparacion > 0) return // el otro lado inicia; yo acepto
            if (comparacion == 0) {
                handler.postDelayed({ intentarConectar(endpointId, nombreRemoto, forzar = true) }, 1_500L)
                return
            }
        }
        conectando.add(endpointId)
        cliente.requestConnection(nombreLocal, endpointId, cicloDeVida)
            .addOnFailureListener {
                conectando.remove(endpointId)
                enfriar(endpointId)
            }
    }

    private fun enfriar(endpointId: String) {
        enfriamientoHasta[endpointId] = System.currentTimeMillis() + ENFRIAMIENTO_MS
    }

    private val cicloDeVida = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            cliente.acceptConnection(endpointId, receptor)
        }

        override fun onConnectionResult(endpointId: String, resolucion: ConnectionResolution) {
            conectando.remove(endpointId)
            if (resolucion.status.statusCode == ConnectionsStatusCodes.STATUS_OK) {
                conectados.add(endpointId)
                emitir("conectado", mapOf("endpointId" to endpointId))
            } else {
                enfriar(endpointId)
            }
        }

        override fun onDisconnected(endpointId: String) {
            conectados.remove(endpointId)
            conectando.remove(endpointId)
            enfriar(endpointId)
            emitir("desconectado", mapOf("endpointId" to endpointId))
        }
    }

    private val receptor = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            val bytes = payload.asBytes() ?: return
            val completo = reensamblar(endpointId, bytes) ?: return
            emitir(
                "datos",
                mapOf(
                    "endpointId" to endpointId,
                    "datos" to String(completo, StandardCharsets.UTF_8),
                ),
            )
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // El progreso por payload no se usa: la capa LemChat confirma
            // con su propio «ack» y muestra el estado honesto.
        }
    }

    // ------------------------------------------------------------ troceado

    /**
     * Marcos: 'R' + datos si cabe en un payload; si no, serie de
     * 'C' + «id|i|n|» en ASCII + trozo de datos.
     */
    private fun trocear(datos: ByteArray): List<ByteArray> {
        if (datos.size <= TROZO) {
            return listOf(byteArrayOf('R'.code.toByte()) + datos)
        }
        val id = (System.nanoTime() and 0xFFFFFFFF).toString(16)
        val total = (datos.size + TROZO - 1) / TROZO
        return (0 until total).map { i ->
            val desde = i * TROZO
            val hasta = minOf(desde + TROZO, datos.size)
            val cabecera = "C$id|$i|$total|".toByteArray(StandardCharsets.US_ASCII)
            cabecera + datos.copyOfRange(desde, hasta)
        }
    }

    /** Devuelve el mensaje completo, o null si aún faltan trozos. */
    private fun reensamblar(endpointId: String, marco: ByteArray): ByteArray? {
        if (marco.isEmpty()) return null
        return when (marco[0]) {
            'R'.code.toByte() -> marco.copyOfRange(1, marco.size)
            'C'.code.toByte() -> {
                val texto = String(marco, 1, minOf(marco.size - 1, 48), StandardCharsets.US_ASCII)
                val partes = texto.split('|')
                if (partes.size < 4) return null
                val id = partes[0]
                val indice = partes[1].toIntOrNull() ?: return null
                val total = partes[2].toIntOrNull() ?: return null
                val largoCabecera = 1 + id.length + 1 + partes[1].length + 1 + partes[2].length + 1
                val clave = "$endpointId:$id"
                val mapa = troceados.getOrPut(clave) { ConcurrentHashMap() }
                mapa[indice] = marco.copyOfRange(largoCabecera, marco.size)
                totales[clave] = total
                if (mapa.size < total) return null
                val junto = (0 until total).fold(ByteArray(0)) { acc, i -> acc + (mapa[i] ?: ByteArray(0)) }
                troceados.remove(clave)
                totales.remove(clave)
                junto
            }
            else -> null
        }
    }
}
