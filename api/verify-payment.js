import Cors from "cors";
import fetch from "node-fetch";
import admin from "firebase-admin";

// Enable CORS
const cors = Cors({ origin: "*", methods: ["POST", "OPTIONS"] });

// Initialize Firebase Admin with single service key variable
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default function handler(req, res) {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

    const { uid, amount, reference } = req.body;

    if (!uid || !amount || !reference) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.status || verifyData.data.status !== "success") {
        return res.status(400).json({ success: false, message: "Payment verification failed" });
      }

      const userRef = db.collection("users").doc(uid);
      await userRef.update({
        balance: admin.firestore.FieldValue.increment(amount),
        totalRecharge: admin.firestore.FieldValue.increment(amount),
      });

      return res.json({ success: true, message: "Recharge successful" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });
}
