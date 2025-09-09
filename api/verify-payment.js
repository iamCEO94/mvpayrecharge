import fetch from "node-fetch";
import admin from "firebase-admin";

// Initialize Firebase only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    }),
    databaseURL: "https://mvpay-7d2ad-default-rtdb.firebaseio.com"
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST requests allowed" });
  }

  const { reference, userId } = req.body;
  if (!reference || !userId) {
    return res.status(400).json({ message: "Missing parameters" });
  }

  try {
    // Verify payment with Paystack
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      }
    );
    const data = await response.json();

    if (data.status && data.data.status === "success") {
      const amountPaid = data.data.amount / 100; // Convert kobo to naira

      // Update user balance in Firestore
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      let newBalance = amountPaid;
      let totalRecharge = amountPaid;

      if (userDoc.exists) {
        const userData = userDoc.data();
        newBalance += userData.balance || 0;
        totalRecharge += userData.totalRecharge || 0;
      }

      await userRef.set(
        { balance: newBalance, totalRecharge: totalRecharge },
        { merge: true }
      );

      return res.status(200).json({ success: true, amount: amountPaid });
    } else {
      return res.status(400).json({ success: false, message: "Payment failed" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
