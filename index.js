const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

app.get("/my-ip", async (req, res) => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    res.json({ ip: data.ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/create-invoice", async (req, res) => {
  try {
    const { amount, order_id } = req.body;

    if (!amount || !order_id) {
      return res.status(400).json({ status: false, message: "Parâmetros obrigatórios ausentes." });
    }

    const LOGIN = (process.env.ZEROCRYPTO_LOGIN || "").trim();
    const TOKEN = (process.env.ZEROCRYPTO_TOKEN || "").trim();
    const SECRET = (process.env.ZEROCRYPTO_SECRET || "").trim();

    // Formatações possíveis para teste
    const formattedAmount = Number(amount).toFixed(2);

    // Variação 1: sha256(AMOUNT + SECRET + ORDER_ID + LOGIN)
    const rawString1 = formattedAmount + SECRET + order_id + LOGIN;
    const sign1 = crypto.createHash("sha256").update(rawString1).digest("hex");

    // Print no console do Render para depuração
    console.log("=== DEBUG ZEROCRYPTO ===");
    console.log("LOGIN:", LOGIN);
    console.log("TOKEN:", TOKEN ? TOKEN.substring(0, 5) + "..." : "VAZIO");
    console.log("SECRET:", SECRET ? SECRET.substring(0, 5) + "..." : "VAZIO");
    console.log("ORDER_ID:", order_id);
    console.log("AMOUNT:", formattedAmount);
    console.log("RAW STRING 1:", rawString1);
    console.log("SIGN GENERATED:", sign1);
    console.log("========================");

    const formData = new URLSearchParams();
    formData.append("amount", formattedAmount);
    formData.append("token", TOKEN);
    formData.append("sign", sign1);
    formData.append("login", LOGIN);
    formData.append("order_id", String(order_id));

    const response = await fetch("https://zerocryptopay.com/pay/newtrack", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });

    const text = await response.text();
    console.log("RESPOSTA CRUA DO ZEROCRYPTO:", text);

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch (_e) {
      res.status(400).json({ status: false, message: "Erro ZeroCrypto: " + text });
    }
  } catch (error) {
    console.error("ERRO NO PROXY:", error);
    res.status(500).json({ status: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
