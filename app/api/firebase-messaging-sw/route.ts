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
  const js =
    'importScripts("https://www.gstatic.com/firebasejs/11.14.0/firebase-app-compat.js");\n' +
    'importScripts("https://www.gstatic.com/firebasejs/11.14.0/firebase-messaging-compat.js");\n' +
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
    "}\n";
  return new NextResponse(js, {
    headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" },
  });
}
