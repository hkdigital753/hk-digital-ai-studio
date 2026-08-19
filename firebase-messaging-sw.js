importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyBTq6Uj1gxneBlicAmVxjQ61buCOWJplzU",
  authDomain: "hk-digital-notifications.firebaseapp.com",
  projectId: "hk-digital-notifications",
  storageBucket: "hk-digital-notifications.firebasestorage.app",
  messagingSenderId: "548389037751",
  appId: "1:548389037751:web:3905d8a740a52954124f32"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {

  console.log(
    "[firebase-messaging-sw.js] Notification reçue :",
    payload
  );

  const notificationTitle =
    payload.notification?.title ||
    "HK Digital";

  const notificationOptions = {

    body:
      payload.notification?.body ||
      "Nouvelle demande de paiement.",

    icon: "/favicon.ico",

    data: payload.data || {}

  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );

});
