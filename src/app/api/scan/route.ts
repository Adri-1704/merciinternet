import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  try {
    const { image, mediaType } = await request.json();

    if (!image) {
      return Response.json(
        { error: "Aucune image fournie" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Clé API non configurée" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: `Analyse ce ticket de caisse ou cette facture. Extrais les informations suivantes en JSON:
{
  "store": "nom du magasin",
  "date": "YYYY-MM-DD",
  "items": [
    { "description": "nom du produit/service", "amount": 12.50 }
  ],
  "total": 45.90,
  "suggestedCategory": "courses"
}

Pour suggestedCategory, utilise une de ces valeurs: loyer, lamal, 3epilier, impots, courses, transport, telephone, assurances, restaurants, loisirs, vetements, epargne, autre.

Retourne UNIQUEMENT le JSON, sans texte autour. Les montants doivent etre en nombre (pas de string). Si tu ne peux pas lire certaines informations, mets null.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    try {
      const data = JSON.parse(jsonStr);
      return Response.json(data);
    } catch {
      return Response.json(
        { error: "Impossible de lire ce ticket. Essayez avec une photo plus nette." },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "Trop de requetes. Reessayez dans quelques secondes." },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "Erreur d'authentification API" },
        { status: 401 }
      );
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json(
        { error: "Erreur du service d'analyse. Reessayez." },
        { status: 502 }
      );
    }
    return Response.json(
      { error: "Une erreur inattendue est survenue" },
      { status: 500 }
    );
  }
}
