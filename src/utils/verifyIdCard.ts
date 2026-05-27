import { spawn } from 'child_process';
import { CONFIG } from '../config/environment';

export interface ICardVerificationResult {
  extracted_auid: string;
  extracted_university: string;
  is_valid_university: boolean;
  matches_auid: boolean;
  ocr_error?: string;
}

interface PythonOcrResult {
  success: boolean;
  text?: string;
  error?: string;
}

const VALID_UNIVERSITIES = ['Akal University', 'Eternal University'] as const;

function normalizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ');
}

function passthroughResult(auid: string, expectedUniversity?: string): ICardVerificationResult {
  return {
    extracted_auid: auid,
    extracted_university: expectedUniversity || '',
    is_valid_university: true,
    matches_auid: true,
  };
}

function detectUniversity(text: string, expectedUniversity?: string) {
  const normalized = normalizeText(text);

  if (normalized.includes('akal university')) return 'Akal University';
  if (normalized.includes('eternal university') || normalized.includes('baru sahib')) {
    return 'Eternal University';
  }

  if (expectedUniversity && normalized.includes(normalizeText(expectedUniversity))) {
    return expectedUniversity;
  }

  return '';
}

function extractStudentId(text: string, expectedAuid: string) {
  const expected = normalizeId(expectedAuid);
  const compactText = normalizeId(text);

  if (expected && compactText.includes(expected)) return expectedAuid;

  const labeledPatterns = [
    /(?:AUID|AU\s*ID|Registration\s*(?:No|Number)?|Reg\.?\s*No|Roll\s*(?:No|Number)?|Student\s*ID|ID\s*No)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 -]{4,20})/gi,
  ];

  for (const pattern of labeledPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const candidate = normalizeId(match[1] || '');
      if (candidate.length >= 5 && candidate.length <= 15 && /\d/.test(candidate)) {
        return candidate;
      }
    }
  }

  const candidates = text.match(/[A-Z0-9]{5,15}/gi) || [];
  const candidate = candidates.map(normalizeId).find((value) => /\d/.test(value));

  return candidate || '';
}

function runPythonOcr(imageBuffer: Buffer, mimeType: string): Promise<PythonOcrResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(CONFIG.ocr.pythonBin, [CONFIG.ocr.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python OCR exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout || '{}'));
      } catch {
        reject(new Error(`Python OCR returned invalid JSON: ${stdout}`));
      }
    });

    child.stdin.write(
      JSON.stringify({
        image_base64: imageBuffer.toString('base64'),
        mime_type: mimeType,
      })
    );
    child.stdin.end();
  });
}

export async function verifyIdCard(
  imageBuffer: Buffer,
  mimeType: string,
  auid: string,
  expectedUniversity?: string
): Promise<ICardVerificationResult> {
  const verificationMode = CONFIG.ocr.verificationMode.toLowerCase();

  if (verificationMode === 'disabled') {
    return passthroughResult(auid, expectedUniversity);
  }

  try {
    const ocr = await runPythonOcr(imageBuffer, mimeType);

    if (!ocr.success || !ocr.text) {
      if (verificationMode === 'review') return passthroughResult(auid, expectedUniversity);

      return {
        extracted_auid: '',
        extracted_university: '',
        is_valid_university: false,
        matches_auid: false,
        ocr_error: ocr.error || 'Python OCR did not return text.',
      };
    }

    const extractedUniversity = detectUniversity(ocr.text, expectedUniversity);
    const extractedAuid = extractStudentId(ocr.text, auid);

    return {
      extracted_auid: extractedAuid,
      extracted_university: extractedUniversity,
      is_valid_university: VALID_UNIVERSITIES.includes(extractedUniversity as any),
      matches_auid: normalizeId(extractedAuid) === normalizeId(auid),
    };
  } catch (error: any) {
    if (verificationMode === 'review') return passthroughResult(auid, expectedUniversity);

    return {
      extracted_auid: '',
      extracted_university: '',
      is_valid_university: false,
      matches_auid: false,
      ocr_error: error?.message || 'Python OCR failed.',
    };
  }
}
