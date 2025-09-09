// api/verify-payment.js
import fetch from "node-fetch";
import admin from "firebase-admin";

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { reference, uid, amount } = req.body;

  if (!reference || !uid || !amount) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    // Verify transaction with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, // 🔑 your Paystack SECRET key in Vercel
      },
    });
    const data = await response.json();

    if (data.status && data.data.status === "success") {
      const userRef = db.collection("users").doc(uid);

      await db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        if (!doc.exists) throw new Error("User not found");

        const currentBalance = doc.data().balance || 0;
        const totalRecharge = doc.data().totalRecharge || 0;

        t.update(userRef, {
          balance: currentBalance + Number(amount),
          totalRecharge: totalRecharge + Number(amount),
        });
      });

      return res.status(200).json({ success: true, message: "Payment verified and wallet updated" });
    } else {
      return res.status(400).json({ success: false, message: "Verification failed" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
