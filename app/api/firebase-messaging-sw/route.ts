import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
  const configStr = JSON.stringify(config);
  // Use 9.2.0: 11.x returns 404 on gstatic; this version matches Firebase quickstart SW
  const js =
    'importScripts("https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js");\n' +
    'importScripts("https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js");\n' +
    "var firebaseConfig = " +
    configStr +
    ";\n" +
    "if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {\n" +
    "  firebase.initializeApp(firebaseConfig);\n" +
    "  var messaging = firebase.messaging();\n" +
    "  messaging.onBackgroundMessage(function(payload) {\n" +
    '    var title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "ARMY Ticket Board";\n' +
    '    var body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "";\n' +
    '    var options = { body: body, icon: "/army-ticket-board-logo.png", data: payload.data || {} };\n' +
    "    self.registration.showNotification(title, options);\n" +
    "  });\n" +
    "}\n" +
    "self.addEventListener(\"notificationclick\", function(event) {\n" +
    "  event.notification.close();\n" +
    "  var data = event.notification.data || {};\n" +
    "  var path = \"/\";\n" +
    "  if (data.merchConnectionId) path = \"/merch/connections/\" + encodeURIComponent(data.merchConnectionId);\n" +
    "  else if (data.connectionId) path = \"/connections/\" + encodeURIComponent(data.connectionId);\n" +
    "  else if (data.listingId && data.type === \"listing_alert\") path = \"/tickets\";\n" +
    "  var url = new URL(path, self.location.origin).href;\n" +
    "  event.waitUntil(\n" +
    "    clients.matchAll({ type: \"window\", includeUncontrolled: true }).then(function(clientList) {\n" +
    "      for (var i = 0; i < clientList.length; i++) {\n" +
    "        var client = clientList[i];\n" +
    "        if (client.url.indexOf(self.location.origin) !== -1 && \"focus\" in client) {\n" +
    "          client.navigate(url);\n" +
    "          return client.focus();\n" +
    "        }\n" +
    "      }\n" +
    "      if (clients.openWindow) return clients.openWindow(url);\n" +
    "    })\n" +
    "  );\n" +
    "});\n";
  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
