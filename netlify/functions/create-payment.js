exports.handler = async function (event) {

    // --------------------------------------------------
    // 1. Vérification de la méthode HTTP
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

        } catch (error) {

            return {
                statusCode: 400,

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    success: false,
                    error: "Les données reçues ne sont pas un JSON valide."
                })
            };
        }


        const plan =
            String(body.plan || "")
                .trim()
                .toUpperCase();

        const email =
            String(body.email || "")
                .trim();

        const userId =
            String(body.user_id || "")
                .trim();


        console.log(
            "========== NOUVELLE DEMANDE DE PAIEMENT =========="
        );

        console.log(
            "Plan reçu :",
            plan
        );

        console.log(
            "Email reçu :",
            email ? "présent" : "absent"
        );

        console.log(
            "User ID reçu :",
            userId ? "présent" : "absent"
        );


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


        const selectedPlan =
            plans[plan];


        if (!selectedPlan) {

            return {
                statusCode: 400,

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    success: false,

                    error:
                        "Formule d'abonnement inconnue.",

                    received_plan:
                        plan

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
        // 5. Récupération de la clé secrète FedaPay
        // --------------------------------------------------

        const secretKey =
            process.env.FEDAPAY_SECRET_KEY;


        if (!secretKey) {

            console.error(
                "FEDAPAY_SECRET_KEY est absente."
            );

            return {
                statusCode: 500,

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    success: false,

                    error:
                        "La clé secrète FedaPay n'est pas configurée dans Netlify."

                })
            };
        }


        console.log(
            "FEDAPAY_SECRET_KEY détectée : OUI"
        );


        // --------------------------------------------------
        // 6. API FedaPay TEST
        // --------------------------------------------------

        const fedapayApi =
            "https://sandbox-api.fedapay.com";


        // --------------------------------------------------
        // 7. Création de la transaction
        // --------------------------------------------------

        console.log(
            "Création de la transaction FedaPay TEST..."
        );


        const transactionResponse =
            await fetch(
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

                            plan:
                                plan,

                            email:
                                email,

                            user_id:
                                userId,

                            credits:
                                selectedPlan.credits,

                            duration:
                                selectedPlan.duration

                        }

                    })
                }
            );


        // --------------------------------------------------
        // 8. Lecture de la réponse FedaPay
        // --------------------------------------------------

        const responseText =
            await transactionResponse.text();


        let transactionData;


        try {

            transactionData =
                JSON.parse(responseText);

        } catch (error) {

            console.error(
                "La réponse FedaPay n'est pas du JSON."
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
                        "FedaPay a retourné une réponse invalide.",

                    fedapay_status:
                        transactionResponse.status

                })

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
        // 9. Vérification du statut HTTP
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
        // 10. Récupération de la transaction
        //
        // FedaPay retourne :
        //
        // {
        //   "v1/transaction": {
        //       "id": ...,
        //       "payment_url": ...
        //   }
        // }
        // --------------------------------------------------

        const transaction =
            transactionData["v1/transaction"];


        if (!transaction) {

            console.error(
                "La propriété v1/transaction est absente."
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
                        "La réponse FedaPay ne contient pas v1/transaction.",

                    fedapay_response:
                        transactionData

                })

            };
        }


        // --------------------------------------------------
        // 11. Identifiant de transaction
        // --------------------------------------------------

        const transactionId =
            transaction.id;


        console.log(
            "ID transaction détecté :",
            transactionId || "NON TROUVÉ"
        );


        if (!transactionId) {

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

                    fedapay_response:
                        transactionData

                })

            };
        }


        // --------------------------------------------------
        // 12. Récupération directe du lien de paiement
        // --------------------------------------------------

        const paymentUrl =
            transaction.payment_url;


        console.log(
            "Lien de paiement détecté :",
            paymentUrl ? "OUI" : "NON"
        );


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
                        "FedaPay a créé la transaction mais n'a pas retourné de lien de paiement.",

                    transaction_id:
                        transactionId,

                    fedapay_response:
                        transactionData

                })

            };
        }


        // --------------------------------------------------
        // 13. Succès
        // --------------------------------------------------

        console.log(
            "========== PAIEMENT PRÊT =========="
        );

        console.log(
            "Transaction :",
            transactionId
        );

        console.log(
            "Référence :",
            transaction.reference || "non disponible"
        );

        console.log(
            "Montant :",
            transaction.amount
        );

        console.log(
            "Statut :",
            transaction.status
        );

        console.log(
            "Lien de paiement généré : OUI"
        );


        // --------------------------------------------------
        // 14. Retour vers l'application
        // --------------------------------------------------

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

                reference:
                    transaction.reference || null,

                status:
                    transaction.status || "pending",

                plan:
                    plan,

                amount:
                    selectedPlan.amount,

                credits:
                    selectedPlan.credits

            })

        };


    } catch (error) {

        // --------------------------------------------------
        // 15. Erreur générale
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
                    error.message ||
                    "Erreur inconnue."

            })

        };
    }
};
