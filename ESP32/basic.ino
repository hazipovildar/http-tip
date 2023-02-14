#include <WiFi.h>
#include <WiFiClient.h>
#include <WebServer.h>
#include <ESPmDNS.h>

const char* ssid = "Home";
const char* password = "pa$$w0rD";

WebServer server(80);

const int led = 27;

void setup(void) {
  pinMode(led, OUTPUT);
  digitalWrite(led, 0);
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.println("");

  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected to ");
  Serial.println(ssid);
  Serial.print("IP address: "); // <- http://ip/on
  Serial.println(WiFi.localIP());

  if (MDNS.begin("esp32")) {
    Serial.println("MDNS responder started");
  }

  server.on("/on", []() {
    server.send(200, "text/plain", "ok");
    if (server.args() > 0) {
      int delayTime = server.arg(0).toInt();
      digitalWrite(led, 1);
      delay(delayTime);
      digitalWrite(led, 0);
    } else {
       digitalWrite(led, 1);
    }
  });

  server.on("/off", []() {
    digitalWrite(led, 0);
    server.send(200, "text/plain", "ok");
  });

  // http://ip/off
  // http://ip/on
  // http://ip/on?delay=100

  server.begin();
  Serial.println("HTTP server started");
}

void loop(void) {
  server.handleClient();
  delay(2);
}
