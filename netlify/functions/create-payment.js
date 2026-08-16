exports.handler = async function (event) {

    // --------------------------------------------------
    // 1. Vérification de la méthode
    // --------------------------------------------------

    if (event.httpMethod !== "POST") {

        return {
            statusCode: 405,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: false,
                error: "Méthode non autorisée."
            })
        };

    }


    try {

        // --------------------------------------------------
        // 2. Lecture des données envoyées par l'application
        // --------------------------------------------------

        let body = {};

        try {

            body = JSON.parse(event.body || "{}");

        } catch (parseError) {

            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    error: "Les données reçues ne sont pas au format JSON."
                })
            };

        }


        const plan = String(body.plan || "").trim().toUpperCase();

        const email = String(body.email || "").trim();

        const userId = String(body.user_id || "").trim();


        console.log("========== NOUVELLE DEMANDE DE PAIEMENT ==========");

        console.log("Plan reçu :", plan);

        console.log("Email reçu :", email ? "présent" : "absent");

        console.log("User ID reçu :", userId ? "présent" : "absent");


        // --------------------------------------------------
        // 3. Vérification des données obligatoires
        // --------------------------------------------------

        if (!plan) {

            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    error: "La formule d'abonnement est obligatoire."
                })
            };

        }


        if (!email) {

            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    error: "L'adresse email est obligatoire."
                })
            };

        }


        // --------------------------------------------------
        // 4. Formules HK Digital
        // --------------------------------------------------

        const plans = {

            JOURNALIER: {
                name: "Abonnement Journalier",
                amount: 200,
                credits: 20,
                duration: "1 jour"
            },

            HEBDOMADAIRE: {
                name: "Abonnement Hebdomadaire",
                amount: 1000,
                credits: 150,
                duration: "7 jours"
            },

            MENSUEL: {
                name: "Abonnement Mensuel",
                amount: 3000,
                credits: 600,
                duration: "30 jours"
            },

            ANNUEL: {
                name: "Abonnement Annuel",
                amount: 30000,
                credits: 8000,
                duration: "365 jours"
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
                    success: false,
                    error: "Formule inconnue.",
                    received_plan: plan
                })
            };

        }


        console.log(
            "Formule sélectionnée :",
            selectedPlan.name
        );

        console.log(
            "Montant :",
            selectedPlan.amount,
            "XOF"
        );


        // --------------------------------------------------
        // 5. Vérification de la clé FedaPay
        // --------------------------------------------------

        const secretKey =
            process.env.FEDAPAY_SECRET_KEY;


        if (!secretKey) {

            console.error(
                "ERREUR : FEDAPAY_SECRET_KEY est absente."
            );

            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    error: "La clé secrète FedaPay n'est pas configurée dans Netlify."
                })
            };

        }


        console.log(
            "FEDAPAY_SECRET_KEY détectée : OUI"
        );


        // --------------------------------------------------
        // 6. URL FedaPay TEST
        // --------------------------------------------------

        const fedapayApi =
            "https://sandbox-api.fedapay.com";


        // --------------------------------------------------
        // 7. Création de la transaction
        // --------------------------------------------------

        console.log(
            "Création de la transaction FedaPay TEST..."
        );


        const transactionResponse = await fetch(
            `${fedapayApi}/v1/transactions`,
            {
                method: "POST",

                headers: {

                    "Authorization":
                        `Bearer ${secretKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                },

                body: JSON.stringify({

                    description:
                        selectedPlan.name,

                    amount:
                        selectedPlan.amount,

                    currency: {
                        iso: "XOF"
                    },

                    callback_url:
                        `${process.env.URL || "https://hk-digital-stu-ai.netlify.app"}/?payment=return`,

                    custom_metadata: {

                        plan: plan,

                        email: email,

                        user_id: userId,

                        credits:
                            selectedPlan.credits,

                        duration:
                            selectedPlan.duration

                    }

                })

            }
        );


        // --------------------------------------------------
        // 8. Lire la réponse FedaPay
        // --------------------------------------------------

        const responseText =
            await transactionResponse.text();


        let transactionData = null;


        try {

            transactionData =
                JSON.parse(responseText);

        } catch (jsonError) {

            transactionData = {
                raw_response:
                    responseText
            };

        }


        console.log(
            "========== RÉPONSE FEDAPAY =========="
        );

        console.log(
            "HTTP STATUS :",
            transactionResponse.status
        );

        console.log(
            "Réponse FedaPay :",
            JSON.stringify(
                transactionData,
                null,
                2
            )
        );


        // --------------------------------------------------
        // 9. Si FedaPay refuse la transaction
        // --------------------------------------------------

        if (!transactionResponse.ok) {

            console.error(
                "FedaPay a refusé la création de la transaction."
            );

            return {
                statusCode:
                    transactionResponse.status,

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    success: false,

                    error:
                        "FedaPay a refusé la création de la transaction.",

                    fedapay_status:
                        transactionResponse.status,

                    fedapay_response:
                        transactionData

                })

            };

        }


        // --------------------------------------------------
        // 10. Recherche robuste de l'ID
        // --------------------------------------------------

        const transaction =
            transactionData?.v1 ||
            transactionData?.transaction ||
            transactionData;


        const transactionId =
            transaction?.id ||
            transaction?.transaction_id ||
            transactionData?.id ||
            transactionData?.transaction_id;


        console.log(
            "ID transaction détecté :",
            transactionId || "NON TROUVÉ"
        );


        // --------------------------------------------------
        // 11. Si aucun ID n'est trouvé
        // --------------------------------------------------

        if (!transactionId) {

            console.error(
                "FedaPay a répondu mais aucun identifiant n'a été trouvé."
            );

            return {
                statusCode: 502,

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    success: false,

                    error:
                        "FedaPay n'a pas retourné d'identifiant de transaction.",

                    diagnostic:
                        "La transaction semble avoir été reçue, mais la structure de la réponse doit être vérifiée.",

                    fedapay_response:
                        transactionData

                })

            };

        }


        // --------------------------------------------------
        // 12. Demander le token de paiement
        // --------------------------------------------------

        console.log(
            "Demande du token de paiement..."
        );


        const tokenResponse = await fetch(

            `${fedapayApi}/v1/transactions/${transactionId}/token`,

            {

                method: "POST",

                headers: {

                    "Authorization":
                        `Bearer ${secretKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        );


        const tokenText =
            await tokenResponse.text();


        let tokenData = null;


        try {

            tokenData =
                JSON.parse(tokenText);

        } catch (jsonError) {

            tokenData = {
                raw_response:
                    tokenText
            };

        }


        console.log(
            "========== RÉPONSE TOKEN FEDAPAY =========="
        );

        console.log(
            "HTTP STATUS TOKEN :",
            tokenResponse.status
        );

        console.log(
            "Réponse token :",
            JSON.stringify(
                tokenData,
                null,
                2
            )
        );


        // --------------------------------------------------
        // 13. Vérifier le token
        // --------------------------------------------------

        if (!tokenResponse.ok) {

            return {
                statusCode:
                    tokenResponse.status,

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    success: false,

                    error:
                        "La transaction a été créée, mais FedaPay n'a pas généré le lien de paiement.",

                    transaction_id:
                        transactionId,

                    fedapay_response:
                        tokenData

                })

            };

        }


        // --------------------------------------------------
        // 14. Recherche robuste du lien de paiement
        // --------------------------------------------------

        const paymentUrl =

            tokenData?.url ||

            tokenData?.payment_url ||

            tokenData?.paymentUrl ||

            tokenData?.redirect_url ||

            tokenData?.token_url ||

            tokenData?.v1?.url ||

            tokenData?.v1?.payment_url;


        console.log(
            "Lien de paiement détecté :",
            paymentUrl ? "OUI" : "NON"
        );


        // --------------------------------------------------
        // 15. Si aucun lien n'est trouvé
        // --------------------------------------------------

        if (!paymentUrl) {

            return {

                statusCode: 502,

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    success: false,

                    error:
                        "FedaPay a créé la transaction mais aucun lien de paiement n'a été trouvé.",

                    transaction_id:
                        transactionId,

                    fedapay_response:
                        tokenData

                })

            };

        }


        // --------------------------------------------------
        // 16. Succès
        // --------------------------------------------------

        console.log(
            "========== PAIEMENT PRÊT =========="
        );

        console.log(
            "Transaction :",
            transactionId
        );

        console.log(
            "Lien de paiement généré : OUI"
        );


        return {

            statusCode: 200,

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                success: true,

                payment_url:
                    paymentUrl,

                transaction_id:
                    transactionId,

                plan:
                    plan,

                amount:
                    selectedPlan.amount

            })

        };


    } catch (error) {


        // --------------------------------------------------
        // 17. Erreur générale
        // --------------------------------------------------

        console.error(
            "========== ERREUR GÉNÉRALE =========="
        );

        console.error(
            error
        );


        return {

            statusCode: 500,

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                success: false,

                error:
                    "Erreur interne lors de la préparation du paiement.",

                message:
                    error.message || "Erreur inconnue."

            })

        };

    }

};
