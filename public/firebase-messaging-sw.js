// Firebase Cloud Messaging service worker. Replace __FIREBASE_CONFIG__ with actual config in build or at runtime.
// In production, this file should be generated or populated with your Firebase config so the SW can initialize FCM.

importScripts("https://www.gstatic.com/firebasejs/11.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.14.0/firebase-messaging-compat.js");

const config = typeof __FIREBASE_CONFIG__ !== "undefined" ? __FIREBASE_CONFIG__ : {};
if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? "ARMY Ticket Board";
    const options = {
      body: payload.notification?.body ?? payload.data?.body ?? "",
      icon: "/army-ticket-board-logo.png",
      data: payload.data ?? {},
    };
    self.registration.showNotification(title, options);
  });
}
