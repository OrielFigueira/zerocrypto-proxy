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

    // Bateria de variações de montagem de Hash
    const hashVariations = [
      {
        name: "1. Usando TOKEN em vez de SECRET (amount + TOKEN + order_id + login)",
        raw: formattedAmount + TOKEN + order_id + LOGIN
      },
      {
        name: "2. Ordem: login + secret + order_id + amount",
        raw: LOGIN + SECRET + order_id + formattedAmount
      },
      {
        name: "3. Ordem: order_id + amount + secret + login",
        raw: order_id + formattedAmount + SECRET + LOGIN
      },
      {
        name: "4. Ordem: token + secret + amount + order_id",
        raw: TOKEN + SECRET + formattedAmount + order_id
      },
      {
        name: "5. Sem casas decimais com SECRET (ex: 2.31 -> 2.31 / sem toFixed se for numero exato)",
        raw: amount + SECRET + order_id + LOGIN
      }
    ];

    let lastData = null;

    for (const item of hashVariations) {
      const sign = crypto.createHash("sha256").update(item.raw).digest("hex");

      console.log(`=== TESTANDO: ${item.name} ===`);
      console.log("RAW:", item.raw);
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
        lastData = JSON.parse(text);
      } catch (_e) {
        lastData = { status: false, message: text };
      }

      if (lastData && (lastData.status === true || lastData.url_to_pay)) {
        console.log(`>>> SUCESSO ABSOLUTO! FUNCIONOU COM: ${item.name} <<<`);
        return res.json(lastData);
      }
    }

    return res.json(lastData);

  } catch (error) {
    console.error("ERRO NO PROXY:", error);
    res.status(500).json({ status: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
