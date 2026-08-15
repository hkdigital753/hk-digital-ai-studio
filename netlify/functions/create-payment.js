exports.handler = async function (event) {
  // Autoriser uniquement les requêtes POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Méthode non autorisée"
      })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const email = String(body.email || "").trim();
    const plan = String(body.plan || "").trim().toUpperCase();

    if (!email || !plan) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Email et formule obligatoires."
        })
      };
    }

    // TARIFS HK DIGITAL
    // Le prix est défini côté serveur pour éviter
    // qu'un utilisateur puisse le modifier dans le navigateur.
    const plans = {
      JOURNALIER: {
        name: "Abonnement Journalier",
        amount: 200,
        credits: 20
      },
      HEBDOMADAIRE: {
        name: "Abonnement Hebdomadaire",
        amount: 1000,
        credits: 150
      },
      MENSUEL: {
        name: "Abonnement Mensuel",
        amount: 3000,
        credits: 700
      },
      ANNUEL: {
        name: "Abonnement Annuel",
        amount: 30000,
        credits: 10000
      }
    };

    const selectedPlan = plans[plan];

    if (!selectedPlan) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Formule inconnue."
        })
      };
    }

    const secretKey = process.env.FEDAPAY_SECRET_KEY;

    if (!secretKey) {
      console.error("FEDAPAY_SECRET_KEY est absente.");

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Configuration FedaPay manquante."
        })
      };
    }

    const siteUrl =
      process.env.URL || "https://hk-digital-studio-ia.netlify.app";

    // 1. Création de la transaction FedaPay TEST
    const transactionResponse = await fetch(
      "https://sandbox-api.fedapay.com/v1/transactions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          description: selectedPlan.name,
          amount: selectedPlan.amount,
          currency: {
            iso: "XOF"
          },
          callback_url: `${siteUrl}/?payment=return`,
          custom_metadata: {
            plan: plan,
            email: email,
            credits: selectedPlan.credits
          }
        })
      }
    );

    const transactionData = await transactionResponse.json();

    if (!transactionResponse.ok) {
      console.error("Erreur création transaction:", transactionData);

      return {
        statusCode: transactionResponse.status,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Impossible de créer la transaction FedaPay.",
          details: transactionData
        })
      };
    }

    const transaction =
      transactionData.v1 || transactionData;

    const transactionId = transaction.id;

    if (!transactionId) {
      console.error("ID transaction absent:", transactionData);

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "FedaPay n'a pas retourné d'identifiant de transaction."
        })
      };
    }

    // 2. Génération du lien de paiement
    const tokenResponse = await fetch(
      `https://sandbox-api.fedapay.com/v1/transactions/${transactionId}/token`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Erreur génération lien:", tokenData);

      return {
        statusCode: tokenResponse.status,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Impossible de générer le lien de paiement.",
          details: tokenData
        })
      };
    }

    if (!tokenData.url) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "FedaPay n'a pas retourné de lien de paiement."
        })
      };
    }

    // 3. Retourner uniquement les informations nécessaires
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: true,
        payment_url: tokenData.url,
        transaction_id: transactionId,
        plan: plan,
        amount: selectedPlan.amount
      })
    };

  } catch (error) {
    console.error("Erreur serveur:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Erreur interne du serveur."
      })
    };
  }
};
