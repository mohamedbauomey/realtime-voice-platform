/**
 * Enhanced Arabic Voice Configuration
 * Optimized settings for Arabic and Egyptian dialect TTS
 */

export const ARABIC_VOICE_CONFIG = {
  // Best voices for Arabic (tested)
  voices: {
    primary: 'nova',      // Best overall for Arabic
    secondary: 'shimmer', // Good for softer Arabic
    male: 'onyx',        // Male Arabic voice
    fallback: 'alloy'    // Fallback option
  },
  
  // Speed settings for clarity
  speed: {
    arabic: 0.85,        // Much slower for Arabic clarity
    egyptian: 0.9,       // Slower for Egyptian dialect
    english: 1.0         // Normal speed for English
  },
  
  // Audio quality settings
  quality: {
    model: 'tts-1-hd',   // HD model for best quality
    format: 'opus',      // Opus format for better quality
    sampleRate: 24000    // Higher sample rate
  },
  
  // Text preprocessing for Arabic
  preprocessing: {
    // Add diacritics for better pronunciation (tashkeel)
    addDiacritics: false, // Can be enabled if needed
    
    // Normalize Arabic text
    normalizeText: true,
    
    // Add punctuation if missing
    addPunctuation: true,
    
    // RTL formatting
    addRTLMarks: true
  },
  
  // Egyptian dialect specific
  egyptian: {
    // Common Egyptian phrases that need special handling
    phrases: {
      'إزيك': 'ezzayak',
      'عامل إيه': 'aamel eh',
      'تمام': 'tamam',
      'خلاص': 'khalas',
      'يلا': 'yalla',
      'إن شاء الله': 'inshallah'
    },
    
    // Use slightly different voice for Egyptian
    voice: 'nova',
    speed: 1.2
  },
  
  // System prompts for better Arabic responses
  prompts: {
    arabic: 'أنت مساعد صوتي ذكي يتحدث العربية الفصحى بطلاقة. تحدث بوضوح تام وببطء شديد. استخدم جملاً قصيرة جداً ومفردات بسيطة. انطق كل كلمة بوضوح منفصلة عن الأخرى. تجنب الكلمات الصعبة أو المعقدة. أجب بجملة أو جملتين فقط في كل مرة.',
    
    egyptian: 'انت مساعد صوتي بيتكلم عربي مصري. اتكلم بالراحة جداً وبوضوح. خلي الكلام بسيط وسهل. رد بجملة واحدة أو اتنين بس. انطق كل كلمة واضحة. متستخدمش كلام صعب.',
    
    mixed: 'أنت مساعد يتحدث العربية والإنجليزية. عند التحدث بالعربية، تكلم ببطء شديد ووضوح. استخدم جملاً بسيطة وقصيرة. When speaking English, be clear and concise. Keep responses very short for voice clarity.'
  }
};

/**
 * Process Arabic text for optimal TTS
 */
export function processArabicText(text: string, dialect: 'arabic' | 'egyptian' = 'arabic'): string {
  let processed = text.trim();
  
  // Remove existing directional marks
  processed = processed.replace(/[\u202A-\u202E]/g, '');
  
  // Normalize whitespace
  processed = processed.replace(/\s+/g, ' ');
  
  // Add RTL marks
  processed = '\u202B' + processed + '\u202C';
  
  // Add punctuation if missing
  if (!processed.match(/[.!?،؛؟]$/)) {
    processed += '.';
  }
  
  // Egyptian dialect adjustments
  if (dialect === 'egyptian') {
    // Replace formal Arabic with Egyptian equivalents
    processed = processed
      .replace(/كيف حالك/g, 'إزيك')
      .replace(/ماذا تفعل/g, 'عامل إيه')
      .replace(/شكرا/g, 'متشكر');
  }
  
  return processed;
}

/**
 * Get optimal voice settings for language
 */
export function getVoiceSettings(text: string) {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F]/;
  const egyptianPattern = /(إزيك|عامل إيه|تمام|خلاص|يلا)/;
  
  if (egyptianPattern.test(text)) {
    return {
      voice: ARABIC_VOICE_CONFIG.egyptian.voice,
      speed: ARABIC_VOICE_CONFIG.egyptian.speed,
      model: ARABIC_VOICE_CONFIG.quality.model
    };
  } else if (arabicPattern.test(text)) {
    return {
      voice: ARABIC_VOICE_CONFIG.voices.primary,
      speed: ARABIC_VOICE_CONFIG.speed.arabic,
      model: ARABIC_VOICE_CONFIG.quality.model
    };
  } else {
    return {
      voice: 'nova',
      speed: ARABIC_VOICE_CONFIG.speed.english,
      model: 'tts-1-hd'
    };
  }
}