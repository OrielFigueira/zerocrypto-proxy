const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Rota auxiliar do IP
app.get("/my-ip", async (req, res) => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    res.json({ ip: data.ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para criar fatura
app.post("/create-invoice", async (req, res) => {
  try {
    const { amount, order_id } = req.body;

    if (!amount || !order_id) {
      return res.status(400).json({ status: false, message: "Parâmetros obrigatórios ausentes." });
    }

    const LOGIN = (process.env.ZEROCRYPTO_LOGIN || "").trim();
    const TOKEN = (process.env.ZEROCRYPTO_TOKEN || "").trim();
    const SECRET = (process.env.ZEROCRYPTO_SECRET || "").trim();

    // Mantém o amount no formato original exatamente como enviado (string/número simples)
    const amountStr = String(amount);
    const orderIdStr = String(order_id);

    // sha256(AMOUNT + SECRET_KEY + ORDER_ID + LOGIN)
    const rawString = amountStr + SECRET + orderIdStr + LOGIN;
    const sign = crypto.createHash("sha256").update(rawString).digest("hex");

    console.log("=== ENVIANDO REQUISIÇÃO (DOC OFICIAL) ===");
    console.log("RAW STRING:", rawString);
    console.log("SIGN:", sign);

    const formData = new URLSearchParams();
    formData.append("amount", amountStr);
    formData.append("token", TOKEN);
    formData.append("sign", sign);
    formData.append("login", LOGIN);
    formData.append("order_id", orderIdStr);

    const response = await fetch("https://zerocryptopay.com/pay/newtrack", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });

    const text = await response.text();
    console.log("RESPOSTA ZEROCRYPTO:", text);

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
