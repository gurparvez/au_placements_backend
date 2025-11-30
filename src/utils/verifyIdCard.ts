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

Tasks:
1. Identify the University Name. It will likely be "Akal University" or "Eternal University". 
  - Convert it to Title Case (e.g., return "Eternal University" not "ETERNAL UNIVERSITY").
  - If the card says "Baru Sahib" but implies Eternal University, return "Eternal University".

2. Extract the unique Student ID.
  - For Akal University, this is usually labeled "AUID" or "Registration No".
  - For Eternal University, this is usually labeled "Roll No" (often found at the bottom left in a colored bar).
  - For Eternal University, some of the cards don't have "Roll No" on the card, 
  for those just say that roll no matched and return the value of extracted_auid the same as sent
  - Return ONLY the alphanumeric/numeric value (e.g., "060124047" or "227106008").

3. Compare the extracted ID with this expected ID: "${auid}".
  - Ignore spaces, hyphens, or case differences during comparison.
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
