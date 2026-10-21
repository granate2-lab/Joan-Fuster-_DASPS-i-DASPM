const MQTT = require('mqtt');
const WebSocket = require('ws');

// =========================================================================
// 1. CONFIGURACIÓN DEL BROKER MQTT (Donde publica la ESP32 de la maqueta)
// =========================================================================
const MQTT_BROKER_URL = 'mqtts://tu-broker-publico.hivemq.cloud:8883'; 
const MQTT_OPTIONS = {
    username: 'tu_usuario_mqtt',
    password: 'tu_password_mqtt',
    clientId: 'servidor_pasarela_intermedia'
};
const MQTT_TOPIC = 'maqueta/telemetria';

// Base de datos en memoria: Guarda siempre el último estado de los 30 potenciómetros
let estadoActualMaqueta = {
    // Ejemplo de estructura inicial: { "pote_01": 0, "pote_02": 0 ... }
};

// Conexión al Broker MQTT
const clienteMQTT = MQTT.connect(MQTT_BROKER_URL, MQTT_OPTIONS);

clienteMQTT.on('connect', () => {
    console.log(' Conectado con éxito al Broker MQTT.');
    clienteMQTT.subscribe(MQTT_TOPIC);
});

clienteMQTT.on('message', (topic, message) => {
    try {
        // La ESP32 envía un JSON. Lo parseamos y actualizamos la memoria del servidor
        const datosRecibidos = JSON.parse(message.toString());
        
        // Fusionamos los nuevos datos con el estado actual
        estadoActualMaqueta = { ...estadoActualMaqueta, ...datosRecibidos };
        
        // Reenviamos este estado actualizado de inmediato a TODOS los Unity conectados
        transmitirAAlumnos(estadoActualMaqueta);
    } catch (error) {
        console.error('Error al procesar el JSON de la ESP32:', error.message);
    }
});

// =========================================================================
// 2. CONFIGURACIÓN DEL SERVIDOR WEBSOCKET (Para los participantes en Unity)
// =========================================================================
// El puerto lo asigna automáticamente el proveedor PaaS (Render/Railway) mediante la variable de entorno
const PUERTO = process.env.PORT || 8080;
const servidorWS = new WebSocket.Server({ port: PUERTO });

console.log(` Servidor WebSocket iniciado en el puerto ${PUERTO}`);

servidorWS.on('connection', (socketUnity) => {
    console.log(' Nuevo participante conectado desde Unity.');

    // TRUCO DE ORO: En cuanto el alumno pulsa Play y se conecta, le enviamos 
    // el último estado guardado para que su maqueta virtual se posicione al instante.
    socketUnity.send(JSON.stringify(estadoActualMaqueta));

    socketUnity.on('close', () => {
        console.log('Un participante ha cerrado su escena de Unity.');
    });
    
    socketUnity.on('error', (err) => {
        console.error('Error en la conexión del cliente:', err.message);
    });
});

// Función auxiliar para emitir los datos a todos los clientes de Unity activos
function transmitirAAlumnos(datos) {
    const dataString = JSON.stringify(datos);
    servidorWS.clients.forEach((cliente) => {
        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(dataString);
        }
    });
}
