/*
 * ESP32 — Envía lecturas de temperatura y humedad al backend de monitoreo.
 *
 * Hardware: ESP32 + DHT11 (o DHT22) en el pin definido por DHTPIN.
 *
 * Antes de subir este sketch:
 *   1. Instalar las librerías: "DHT sensor library" y "ArduinoJson" desde el
 *      Library Manager del Arduino IDE.
 *   2. Cambiar WIFI_SSID y WIFI_PASSWORD por los de tu red.
 *   3. Cambiar DEVICE_CODE por el device_code que te asignó el backend al
 *      crear el dispositivo (ej. "FRIDGE-E31B"), o bien usa el device_id
 *      externo que hayas configurado.
 *   4. Cambiar BACKEND_URL si tu backend corre en otra dirección.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

// ── Configuración WiFi ──────────────────────────────────────
const char* WIFI_SSID     = "TU_SSID";         // ← Cambiar por el nombre de tu red WiFi
const char* WIFI_PASSWORD = "TU_PASSWORD";      // ← Cambiar por la contraseña de tu red

// ── Configuración del sensor DHT ────────────────────────────
#define DHTPIN  4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ── Configuración del backend ───────────────────────────────
const char* BACKEND_URL = "https://backend-monitoreo-production.up.railway.app/api/ingest";
const char* DEVICE_CODE = "FRIDGE-XXXX";        // ← Cambiar por tu device_code o device_id

// ── Intervalo entre lecturas (ms) ───────────────────────────
const unsigned long SEND_INTERVAL = 5000;

void setup() {
  Serial.begin(115200);
  dht.begin();

  // Conectar a WiFi
  Serial.print("Conectando a WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi conectado");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado, reconectando...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("\nWiFi reconectado");
  }

  // Leer sensor DHT
  float temperatura = dht.readTemperature();
  float humedad     = dht.readHumidity();

  if (isnan(temperatura) || isnan(humedad)) {
    Serial.println("Error al leer el sensor DHT");
    delay(SEND_INTERVAL);
    return;
  }

  Serial.printf("Temperatura: %.1f °C  Humedad: %.1f %%\n", temperatura, humedad);

  // Enviar datos al backend
  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  // Construir JSON — el backend acepta device_code o device_id
  String json = "{";
  json += "\"device_code\":\"" + String(DEVICE_CODE) + "\",";
  json += "\"temperatura\":" + String(temperatura, 1) + ",";
  json += "\"humedad\":" + String(humedad, 1);
  json += "}";

  int httpCode = http.POST(json);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("HTTP %d: %s\n", httpCode, response.c_str());
  } else {
    Serial.printf("Error en HTTP POST: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  delay(SEND_INTERVAL);
}
