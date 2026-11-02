// 1) Vào https://console.firebase.google.com → tạo project
// 2) Project settings → General → "Your apps" → thêm Web app (</>)
// 3) Copy object firebaseConfig dán đè lên bên dưới.
// Các giá trị này được phép công khai trên GitHub — bảo mật nằm ở firestore.rules.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");
