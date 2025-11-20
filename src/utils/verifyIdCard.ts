import { GoogleGenAI } from '@google/genai';

export interface ICardVerificationResult {
  extracted_auid: string;
  extracted_university: string;
  is_valid_university: boolean;
  matches_auid: boolean;
}

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function verifyIdCard(
  imageBuffer: Buffer,
  mimeType: string,
  auid: string
): Promise<ICardVerificationResult> {
  const prompt = `
You are an automated ID card OCR + verification system.

STRICT RULES:
- NEVER wrap the response in backticks or code fences.
- NEVER output markdown.
- NEVER add explanations.
- Output ONLY raw JSON.
- The JSON must be the ONLY content in your answer.

TASK:
1. Extract ALL readable text from the ID card image.
2. Identify the printed AUID/UID number.
3. Identify the university name printed on the card.
4. Allowed universities are exactly:
   - "Akal University"
   - "Eternal University"

5. Compare the extracted AUID with this provided AUID: ${auid}
6. If the printed AUID has minor formatting differences (spaces, dashes), treat it as matching.

RESPOND EXACTLY in this format:

{
  "extracted_auid": "....",
  "extracted_university": "....",
  "is_valid_university": true/false,
  "matches_auid": true/false
}

REMEMBER:
- NO backticks.
- NO extra text.
- NO markdown.
- ONLY raw JSON.
`;

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
          { text: prompt },
        ],
      },
    ],
  });

  const text = response?.text ?? '{}';
  console.log(text);

  try {
    const clean = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(clean);

    return {
      extracted_auid: parsed.extracted_auid || '',
      extracted_university: parsed.extracted_university || '',
      is_valid_university: parsed.is_valid_university ?? false,
      matches_auid: parsed.matches_auid ?? false,
    };
  } catch (e) {
    console.log('error', e);
    return {
      extracted_auid: '',
      extracted_university: '',
      is_valid_university: false,
      matches_auid: false,
    };
  }
}
