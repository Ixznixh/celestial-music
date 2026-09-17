import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    try {
      aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn('Failed to initialize GoogleGenAI:', e);
    }
  }
  return aiInstance;
}

/**
 * Deterministic offline Tamil script to Romanized Thanglish transliterator
 */
export function transliterateTamilToThanglish(text: string): string {
  if (!text) return '';

  // Return unchanged if no Tamil unicode characters present
  if (!/[\u0B80-\u0BFF]/.test(text)) {
    return text;
  }

  // Common Tamil word replacements for natural Thanglish
  const wordMap: [RegExp, string][] = [
    [/அன்பே/g, 'Anbe'],
    [/அன்பு/g, 'Anbu'],
    [/கண்ணே/g, 'Kanne'],
    [/கண்/g, 'Kan'],
    [/காதல்/g, 'Kadhal'],
    [/காதலே/g, 'Kadhale'],
    [/உயிரே/g, 'Uyire'],
    [/உயிர்/g, 'Uyir'],
    [/வா/g, 'Vaa'],
    [/போ/g, 'Poo'],
    [/நீ/g, 'Nee'],
    [/நான்/g, 'Naan'],
    [/நானே/g, 'Naane'],
    [/நீயே/g, 'Neeye'],
    [/என்ன/g, 'Enna'],
    [/என்னை/g, 'Ennai'],
    [/உன்னை/g, 'Unnai'],
    [/உன்னோடு/g, 'Unnodu'],
    [/என்னோடு/g, 'Ennodu'],
    [/மனசு/g, 'Manasu'],
    [/மனமே/g, 'Maname'],
    [/பாட்டு/g, 'Paattu'],
    [/பாடல்/g, 'Paadal'],
    [/மலரே/g, 'Malare'],
    [/அழகு/g, 'Azhagu'],
    [/அழகே/g, 'Azhage'],
    [/நிலவே/g, 'Nilave'],
    [/இரவு/g, 'Iravu'],
    [/பகலே/g, 'Pagale'],
    [/நெஞ்சே/g, 'Nenje'],
    [/இதயம்/g, 'Ithayam'],
    [/சொல்/g, 'Sol'],
    [/சொல்லு/g, 'Sollu'],
    [/கேளு/g, 'Kelu'],
    [/பாரு/g, 'Paaru'],
    [/சிரிப்பு/g, 'Sirippu'],
    [/வாழ்க்கை/g, 'Vaazhkai'],
    [/வேண்டும்/g, 'Vendum'],
  ];

  let result = text;
  for (const [regex, rep] of wordMap) {
    result = result.replace(regex, rep);
  }

  // Character-level transliteration for remaining Tamil script
  const vowels: { [key: string]: string } = {
    'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e',
    'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au', 'ஃ': 'akh',
  };

  const consonants: { [key: string]: string } = {
    'க': 'ka', 'ங': 'nga', 'ச': 'cha', 'ஞ': 'nja', 'ட': 'ta', 'ண': 'na',
    'த': 'tha', 'ந': 'na', 'ப': 'pa', 'ம': 'ma', 'ய': 'ya', 'ர': 'ra',
    'ல': 'la', 'வ': 'va', 'ழ': 'zha', 'ள': 'la', 'ற': 'ra', 'ன': 'na',
    'ஜ': 'ja', 'ஷ': 'sha', 'ஸ': 'sa', 'ஹ': 'ha',
  };

  const modifiers: { [key: string]: string } = {
    'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e',
    'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au',
  };

  let output = '';
  const chars = Array.from(result);
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];

    if (vowels[char]) {
      output += vowels[char];
    } else if (consonants[char]) {
      if (nextChar === '்') {
        // Pulli mutes the vowel
        output += consonants[char].replace(/a$/, '');
        i++; // Skip pulli
      } else if (nextChar && modifiers[nextChar]) {
        output += consonants[char].replace(/a$/, '') + modifiers[nextChar];
        i++; // Skip modifier
      } else {
        output += consonants[char];
      }
    } else {
      output += char;
    }
  }

  // Clean up duplicate spaces or weird artifacts
  return output.replace(/\s+/g, ' ').trim();
}

/**
 * Use Gemini 2.5 Flash to fetch or generate synchronized Thanglish lyrics
 */
export async function getGeminiThanglishSyncedLyrics(
  songTitle: string,
  songArtist: string,
  songDuration: number = 210
): Promise<{ time: number; text: string }[] | null> {
  const ai = getAI();
  if (!ai) return null;

  try {
    const prompt = `You are a lyrics and music timing expert specializing in Tamil, Indian, and Global music.
Task: Generate synchronized line-by-line lyrics for the following song:
Title: "${songTitle}"
Artist: "${songArtist}"
Duration: ${songDuration} seconds

CRITICAL REQUIREMENTS:
1. If this song is a Tamil, Hindi, Telugu, or Indian song, write ALL lyrics exclusively in THANGLISH (Tamil or Hindi words rendered strictly in English/Roman alphabet, e.g. "Anbe anbe kollathey", "Kannana Kanne", "Naa Ready Than", "Enna Sona", "Tum Hi Ho"). NEVER output Tamil script (அன்பே) or Devanagari script.
2. If it is an English/Global song, output clean English lyrics.
3. Every lyric line MUST have a synchronized timestamp in seconds ("time"), starting after intro music (e.g. 5-12 seconds in) and progressing sequentially up to ~${Math.round(songDuration * 0.92)} seconds.
4. Spacing and line timing must feel natural for a karaoke singer following the song. Include verse headers like "[Verse 1]", "[Chorus]", "[Bridge]" if applicable.
5. Return ONLY a JSON array of objects. Do NOT wrap in markdown backticks or extra text.

JSON Schema Example:
[
  {"time": 8.0, "text": "[Verse 1]"},
  {"time": 10.5, "text": "Anbe anbe kollathey"},
  {"time": 14.2, "text": "Kanne enne thallathey"}
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text ? response.text.trim() : '';
    if (!responseText) return null;

    // Clean potential markdown wrap if any remains
    const jsonStr = responseText.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const validLines: { time: number; text: string }[] = [];
      for (const item of parsed) {
        if (typeof item === 'object' && item !== null && typeof item.text === 'string') {
          const timeNum = typeof item.time === 'number' && !isNaN(item.time) ? item.time : 0;
          let textStr = item.text.trim();
          
          // Ensure non-English script in AI output is transliterated to Thanglish
          if (/[\u0B80-\u0BFF]/.test(textStr)) {
            textStr = transliterateTamilToThanglish(textStr);
          }

          if (textStr) {
            validLines.push({ time: Math.max(0, timeNum), text: textStr });
          }
        }
      }

      validLines.sort((a, b) => a.time - b.time);
      if (validLines.length > 0) {
        return validLines;
      }
    }
  } catch (err: any) {
    console.warn(`Gemini Thanglish lyrics generation error for "${songTitle}":`, err?.message || err);
  }

  return null;
}

/**
 * Convert native non-Roman lyrics lines into Thanglish using Gemini or transliterator
 */
export async function convertLinesToThanglish(
  lines: { time: number; text: string }[]
): Promise<{ time: number; text: string }[]> {
  if (!lines || lines.length === 0) return [];

  const hasTamilScript = lines.some((l) => /[\u0B80-\u0BFF]/.test(l.text));
  const hasDevanagari = lines.some((l) => /[\u0900-\u097F]/.test(l.text));

  if (!hasTamilScript && !hasDevanagari) {
    return lines;
  }

  // Attempt Gemini transliteration if API key available
  const ai = getAI();
  if (ai) {
    try {
      const rawText = lines.map((l) => l.text).join('\n');
      const prompt = `Transliterate the following Tamil/Hindi song lyrics into clean, natural THANGLISH (Roman/English script Tamil/Hindi).
Keep the EXACT line breaks and line count.
Do NOT translate to English meaning — transliterate phonetically (e.g. "அன்பே அன்பே" -> "Anbe Anbe").

Lyrics:
${rawText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text ? response.text.trim() : '';
      if (responseText) {
        const transliteratedLines = responseText.split('\n').map((s) => s.trim());
        if (transliteratedLines.length === lines.length) {
          return lines.map((line, idx) => ({
            time: line.time,
            text: transliteratedLines[idx] || line.text,
          }));
        }
      }
    } catch {
      // Fallback to deterministic transliterater below
    }
  }

  // Offline deterministic fallback
  return lines.map((l) => ({
    time: l.time,
    text: transliterateTamilToThanglish(l.text),
  }));
}
