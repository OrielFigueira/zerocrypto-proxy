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

    const formattedAmount = Number(amount).toFixed(2);

    // Monta os 3 formatos possíveis de string de assinatura
    const combinations = [
      { name: "Variante 1 (Standard)", raw: formattedAmount + SECRET + order_id + LOGIN },
      { name: "Variante 2 (No OrderID)", raw: formattedAmount + SECRET + LOGIN },
      { name: "Variante 3 (Login antes do OrderID)", raw: formattedAmount + SECRET + LOGIN + order_id }
    ];

    let lastResult = null;

    for (const combo of combinations) {
      // Gera SHA256
      const sign = crypto.createHash("sha256").update(combo.raw).digest("hex");

      console.log(`=== TESTANDO ${combo.name} ===`);
      console.log("RAW STRING:", combo.raw);
      console.log("SIGN:", sign);

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
      console.log("RESPOSTA ZEROCRYPTO:", text);

      try {
        lastResult = JSON.parse(text);
      } catch (_e) {
        lastResult = { status: false, message: text };
      }

      // Se deu sucesso (status: true) ou retornou a URL de pagamento, encerra o loop e responde!
      if (lastResult && (lastResult.status === true || lastResult.url_to_pay)) {
        console.log(`SUCESSO ENCONTRADO NA ${combo.name}!`);
        return res.json(lastResult);
      }
    }

    // Se nenhuma combinação passou, retorna o último resultado
    return res.json(lastResult);

  } catch (error) {
    console.error("ERRO NO PROXY:", error);
    res.status(500).json({ status: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
