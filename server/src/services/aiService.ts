import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

let openaiClient: OpenAI | null = null;
let googleGenAI: any = null;

if (provider === 'openai' && OPENAI_KEY) {
  openaiClient = new OpenAI({ apiKey: OPENAI_KEY });
} else if (provider === 'gemini' && GEMINI_KEY) {
  googleGenAI = new GoogleGenerativeAI(GEMINI_KEY);
}

/**
 * Smart offline mock RAG compiler.
 * Evaluates if the question contains words present in the document.
 * If yes, extracts a sentence. If not, returns the requested fallback message.
 */
const runOfflineMockRAG = (docText: string, question: string): string => {
  const cleanQuestion = question.toLowerCase().replace(/[?.,!]/g, '').trim();
  
  // Check if it's an overview/summarization request (e.g. asking generally about the whole document)
  const isOverviewRequest = 
    /^(summary|summarize|overview)$/i.test(cleanQuestion) ||
    /tell me about this document|what is this document|describe this document/i.test(cleanQuestion);
  
  if (isOverviewRequest) {
    const sentences = docText
      .split(/[.!?\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
      
    if (sentences.length > 0) {
      const summaryText = sentences.slice(0, 4).join('. ') + '.';
      return `[Offline Grounded Summary] Here is an overview of the document: "${summaryText}"`;
    }
  }

  // Stopwords list to prevent matching on common pronouns, verbs, and question words
  const stopwords = new Set([
    'the', 'this', 'that', 'they', 'them', 'these', 'those', 'their', 'there',
    'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
    'about', 'with', 'from', 'your', 'have', 'here', 'tell', 'show', 'please',
    'document', 'file', 'read', 'some', 'many', 'more', 'most', 'somehow',
    'would', 'could', 'should', 'will', 'shall', 'make', 'give', 'find',
    'explain', 'describe', 'define', 'definition', 'meaning', 'concept',
    'structure', 'list', 'write', 'create', 'use', 'using', 'used', 'example',
    'examples', 'topic', 'topics', 'question', 'answer', 'info', 'information',
    'detail', 'details', 'me', 'and', 'for', 'but', 'not', 'are', 'was', 'were',
    'been', 'has', 'had', 'does', 'did', 'done', 'doing', 'can', 'may', 'must',
    'is', 'an', 'a', 'to', 'in', 'of', 'on', 'at', 'by', 'as', 'if'
  ]);

  const keywords = cleanQuestion
    .split(' ')
    .filter(w => w.length > 1 && !stopwords.has(w)); // allow keywords of length > 1 (e.g. 'js', 'ui')
  
  if (keywords.length === 0) {
    return "I couldn't find this information in the uploaded document.";
  }

  // Split document into lines to parse structured sections
  const lines = docText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Find the line that matches our keyword
  let matchIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const cleanLine = lines[i].toLowerCase();
    const isMatch = keywords.some(word => cleanLine.includes(word));
    if (isMatch) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex !== -1) {
    // We found a matching line! Let's collect it and subsequent context lines
    const resultLines: string[] = [lines[matchIndex]];
    
    // Look ahead up to 4 lines to grab the full context of this section
    for (let j = matchIndex + 1; j < Math.min(lines.length, matchIndex + 5); j++) {
      const nextLine = lines[j];
      
      // If the next line looks like a new numbered section header, stop collecting
      if (/^\d+\./.test(nextLine)) {
        break;
      }
      resultLines.push(nextLine);
    }
    
    return `[Offline Grounded Answer] Here is what I found in the document:\n\n${resultLines.join('\n')}`;
  }

  return "I couldn't find this information in the uploaded document.";
};

/**
 * Sends the document context and user question to the selected AI provider.
 * Enforces strict grounding rules.
 */
export const generateGroundedAnswer = async (
  docText: string,
  question: string,
  fileBuffer: Buffer | null = null,
  mimeType: string | null = null,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> => {
  const systemPrompt = `
You are a helpful AI Document Assistant.
Your goal is to answer the user's question.
You MUST rely ONLY on facts mentioned in the document context (provided as text or attached document media).

CRITICAL INSTRUCTIONS:
1. Rely ONLY on the clear facts mentioned in the document context.
2. If the answer cannot be explicitly found in the context, you MUST respond EXACTLY with this string:
   "I couldn't find this information in the uploaded document."
   Do NOT make up an answer, summarize general knowledge, or write any other explanation.
3. Every answer must be factual and completely grounded.
4. You are provided with the conversation history. Use it to resolve pronouns or follow-up references (like "that", "it", "they", "first point", "previous answer"), but do NOT use history to inject any external facts not found in the document context.
`;

  const userPrompt = `
DOCUMENT CONTEXT:
${docText}

-----------------

USER QUESTION:
${question}

Grounded Answer:
`;

  try {
    if (provider === 'openai') {
      if (!openaiClient) {
        console.warn('OpenAI API key missing. Running offline RAG simulation.');
        return runOfflineMockRAG(docText, question);
      }

      const messages: any[] = [{ role: 'system', content: systemPrompt }];
      
      // Inject history
      history.forEach((m) => {
        messages.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        });
      });

      // Append new question
      messages.push({ role: 'user', content: userPrompt });

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.1,
      });

      return response.choices[0]?.message?.content || '';
    } else {
      // Default to Gemini
      if (!googleGenAI) {
        console.warn('Gemini API key missing. Running offline RAG simulation.');
        return runOfflineMockRAG(docText, question);
      }

      const model = googleGenAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });

      // Format contents for multi-turn chat
      const contents: any[] = [];
      history.forEach((m) => {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        });
      });

      let currentParts: any[] = [];
      // If we have a file buffer and it's a PDF or an Image, pass it directly to Gemini
      if (fileBuffer && mimeType && (mimeType === 'application/pdf' || mimeType.startsWith('image/'))) {
        currentParts.push({
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType: mimeType,
          },
        });
        
        currentParts.push({
          text: `
DOCUMENT CONTEXT IS ATTACHED DIRECTLY AS MULTIMODAL MEDIA FILE (PDF/IMAGE).
-----------------

USER QUESTION:
${question}

Grounded Answer:
`
        });
      } else {
        currentParts.push({ text: userPrompt });
      }

      contents.push({ role: 'user', parts: currentParts });

      const result = await model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.1,
        }
      });

      return result.response.text().trim();
    }
  } catch (error) {
    console.error('[AI Service] Generation error:', error);
    // Fallback to local keyword matcher rather than throwing a crash
    return runOfflineMockRAG(docText, question);
  }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function* simulateStream(text: string): AsyncGenerator<string, void, unknown> {
  // Yield in words or characters to simulate typing
  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (word) {
      yield word;
      await delay(20 + Math.random() * 30);
    }
  }
}

/**
 * Streams the grounded answer chunks from the selected AI provider.
 */
export async function* generateGroundedAnswerStream(
  docText: string,
  question: string,
  fileBuffer: Buffer | null = null,
  mimeType: string | null = null,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): AsyncGenerator<string, void, unknown> {
  const systemPrompt = `
You are a helpful AI Document Assistant.
Your goal is to answer the user's question.
You MUST rely ONLY on facts mentioned in the document context (provided as text or attached document media).

CRITICAL INSTRUCTIONS:
1. Rely ONLY on the clear facts mentioned in the document context.
2. If the answer cannot be explicitly found in the context, you MUST respond EXACTLY with this string:
   "I couldn't find this information in the uploaded document."
   Do NOT make up an answer, summarize general knowledge, or write any other explanation.
3. Every answer must be factual and completely grounded.
4. You are provided with the conversation history. Use it to resolve pronouns or follow-up references (like "that", "it", "they", "first point", "previous answer"), but do NOT use history to inject any external facts not found in the document context.
`;

  const userPrompt = `
DOCUMENT CONTEXT:
${docText}

-----------------

USER QUESTION:
${question}

Grounded Answer:
`;

  try {
    if (provider === 'openai') {
      if (!openaiClient) {
        console.warn('OpenAI API key missing. Running offline RAG stream simulation.');
        const mockResult = runOfflineMockRAG(docText, question);
        yield* simulateStream(mockResult);
        return;
      }

      const messages: any[] = [{ role: 'system', content: systemPrompt }];
      
      // Inject history
      history.forEach((m) => {
        messages.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        });
      });

      // Append new query
      messages.push({ role: 'user', content: userPrompt });

      const stream = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.1,
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) yield text;
      }
    } else {
      // Default to Gemini
      if (!googleGenAI) {
        console.warn('Gemini API key missing. Running offline RAG stream simulation.');
        const mockResult = runOfflineMockRAG(docText, question);
        yield* simulateStream(mockResult);
        return;
      }

      const model = googleGenAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });

      // Format contents for multi-turn chat
      const contents: any[] = [];
      history.forEach((m) => {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        });
      });

      let currentParts: any[] = [];
      if (fileBuffer && mimeType && (mimeType === 'application/pdf' || mimeType.startsWith('image/'))) {
        currentParts.push({
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType: mimeType,
          },
        });
        currentParts.push({
          text: `
DOCUMENT CONTEXT IS ATTACHED DIRECTLY AS MULTIMODAL MEDIA FILE (PDF/IMAGE).
-----------------

USER QUESTION:
${question}

Grounded Answer:
`
        });
      } else {
        currentParts.push({ text: userPrompt });
      }

      contents.push({ role: 'user', parts: currentParts });

      const result = await model.generateContentStream({
        contents,
        generationConfig: {
          temperature: 0.1,
        }
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    }
  } catch (error) {
    console.error('[AI Service] Stream generation error:', error);
    const mockResult = runOfflineMockRAG(docText, question);
    yield* simulateStream(mockResult);
  }
}

/**
 * Modifies text based on an edit command (e.g. improve, summarize, lengthen, shorten).
 */
export const generateTextEdit = async (
  text: string,
  command: 'improve' | 'grammar' | 'summarize' | 'longer' | 'shorter' | 'outline'
): Promise<string> => {
  const instructions = {
    improve: 'Improve the clarity, style, and professional flow of the text, keeping its original meaning.',
    grammar: 'Correct any spelling, punctuation, and grammatical errors in the text, preserving its tone.',
    summarize: 'Provide a concise summary of the text.',
    longer: 'Elaborate and expand upon the text, adding detail and depth.',
    shorter: 'Make the text more concise and brief while preserving key information.',
    outline: 'Generate a structured bullet-point outline of the key points in the text.'
  };

  const commandInstruction = instructions[command] || instructions.improve;

  const systemPrompt = `
You are an expert editor and writing assistant.
Your task is to modify the provided text according to the instruction: "${commandInstruction}".
CRITICAL INSTRUCTIONS:
1. Output ONLY the resulting edited text.
2. Do NOT write any introduction, greetings, explanations, or commentary (e.g., do NOT say "Here is the rewritten text:").
3. Do NOT wrap the output in quotes or markdown code blocks unless the user's formatting requires it.
`;

  const userPrompt = `
TEXT TO EDIT:
"""
${text}
"""

Edited Text:
`;

  try {
    if (provider === 'openai') {
      if (!openaiClient) {
        return `[Offline Edit Mode: ${command}] ${text}`;
      }
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      });
      return response.choices[0]?.message?.content || '';
    } else {
      if (!googleGenAI) {
        return `[Offline Edit Mode: ${command}] ${text}`;
      }
      const model = googleGenAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
        }
      });
      return result.response.text().trim();
    }
  } catch (error) {
    console.error('[AI Service] Text edit generation error:', error);
    return `[Offline Edit Mode: ${command}] ${text}`;
  }
};


