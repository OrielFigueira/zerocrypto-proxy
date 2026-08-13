const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Rota auxiliar para descobrir o IP fixo da aplicação
app.get("/my-ip", async (req, res) => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    res.json({ ip: data.ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota principal que gera a fatura no ZeroCryptoPay
app.post("/create-invoice", async (req, res) => {
  try {
    const { amount, order_id } = req.body;

    if (!amount || !order_id) {
      return res.status(400).json({ status: false, message: "Parâmetros obrigatórios ausentes." });
    }

    const LOGIN = process.env.ZEROCRYPTO_LOGIN;
    const TOKEN = process.env.ZEROCRYPTO_TOKEN;
    const SECRET = process.env.ZEROCRYPTO_SECRET;

    // Força a formatação com 2 casas decimais (ex: 15.00)
    const formattedAmount = Number(amount).toFixed(2);

    // Assinatura SHA256: sha256(AMOUNT + SECRET_KEY + ORDER_ID + LOGIN)
    const rawString = formattedAmount + SECRET + order_id + LOGIN;

    const sign = crypto
      .createHash("sha256")
      .update(rawString)
      .digest("hex");

    const formData = new URLSearchParams();
    formData.append("amount", formattedAmount);
    formData.append("token", TOKEN);
    formData.append("sign", sign);
    formData.append("login", LOGIN);
    formData.append("order_id", String(order_id));

    const response = await fetch("https://zerocryptopay.com/pay/newtrack", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch (_e) {
      res.status(400).json({ status: false, message: "Erro ZeroCrypto: " + text });
    }
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
