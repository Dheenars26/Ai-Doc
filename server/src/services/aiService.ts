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
  
  // 1. Check for greetings
  const greetings = ['hi', 'hello', 'hey', 'greetings', 'how are you', 'good morning', 'good afternoon'];
  if (greetings.some(g => cleanQuestion === g || cleanQuestion.startsWith(g + ' '))) {
    return "Hello! I am your AI Document Assistant. How can I help you with your document today?";
  }

  // 2. Check if it's an overview/summarization/key points request
  const isOverviewRequest = 
    /summary|summarize|overview|outline|points|key points|important points|takeaways|highlight/i.test(cleanQuestion) ||
    /tell me about|what is this|describe this/i.test(cleanQuestion);
  
  if (isOverviewRequest) {
    if (!docText || docText.trim().length === 0) {
      return "The active document appears to be empty. Please type some text in the editor or upload a file first!";
    }
    const sentences = docText
      .split(/[.!?\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
      
    if (sentences.length > 0) {
      return `[Your Result] Here are key points from the document:\n\n${sentences.slice(0, 4).map(s => `- ${s}`).join('\n')}`;
    }
  }

  if (!docText || docText.trim().length === 0) {
    return "No document is active in memory. Please upload a document or type in the editor so I can assist you!";
  }

  // 3. Fallback keyword matching
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
    .filter(w => w.length > 1 && !stopwords.has(w));
  
  if (keywords.length === 0) {
    return `I received your question: "${question}". Please ask something specific matching keywords in the document or ask me to summarize it!`;
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
    
    return `[Your Result] Here is what I found in the document:\n\n${resultLines.join('\n')}`;
  }

  return `I couldn't find a direct match for "${keywords.join(', ')}" in the document. Try asking me to summarize it or check your spelling!`;
};

/**
 * Local lightweight semantic chunk selector (RAG).
 * Evaluates the query keywords against paragraphs to fetch the most relevant context,
 * minimizing token overhead, API request size, and model processing latency.
 */
const getRelevantContext = (docText: string, question: string, maxChars = 20000): string => {
  if (!docText || docText.length <= maxChars) {
    return docText;
  }

  // If user wants a summary or outline, send head and tail of doc to capture intro and conclusion
  const isSummaryRequest = /summary|summarize|overview|outline|points|key points|takeaways|highlight/i.test(question);
  if (isSummaryRequest) {
    const headChars = Math.floor(maxChars * 0.7);
    const tailChars = Math.floor(maxChars * 0.3);
    return `${docText.substring(0, headChars)}\n\n[... Context Truncated for Latency Optimization ...]\n\n${docText.substring(docText.length - tailChars)}`;
  }

  // Split document into structured blocks/paragraphs
  const paragraphs = docText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  if (paragraphs.length <= 1) {
    return docText.substring(0, maxChars);
  }

  const cleanQuestion = question.toLowerCase().replace(/[?.,!]/g, '').trim();
  const keywords = cleanQuestion.split(/\s+/).filter(w => w.length > 2);

  if (keywords.length === 0) {
    return docText.substring(0, maxChars);
  }

  // Overlap keyword matching scoring
  const scoredParagraphs = paragraphs.map(para => {
    const lowerPara = para.toLowerCase();
    let score = 0;
    keywords.forEach(word => {
      if (lowerPara.includes(word)) {
        score += 1.0;
        // Bonus points for multiple occurrences
        const occurrences = lowerPara.split(word).length - 1;
        score += occurrences * 0.5;
      }
    });
    return { para, score };
  });

  // Sort by highest score first
  scoredParagraphs.sort((a, b) => b.score - a.score);

  const selected: string[] = [];
  let totalLength = 0;
  for (const item of scoredParagraphs) {
    if (totalLength + item.para.length > maxChars) {
      if (selected.length === 0) {
        selected.push(item.para.substring(0, maxChars));
      }
      break;
    }
    selected.push(item.para);
    totalLength += item.para.length;
  }

  // Keep paragraphs in their original document order to maintain context flow
  const selectedSet = new Set(selected);
  const orderedSelection = paragraphs.filter(p => selectedSet.has(p));

  return orderedSelection.join('\n\n');
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
If the question is about the document, you should answer using the facts in the document context.
If the user asks for summaries, key points, or highlights, generate them using the document content.
If the user greets you (e.g. "Hi", "Hello"), asks general formatting/coding questions, or engages in casual conversation, respond in a helpful, conversational manner.
Try to use the document context whenever relevant, but do not refuse to answer conversational or general questions.
`;

  // Dynamically select relevant text chunk to save tokens and improve response latency
  const relevantContext = getRelevantContext(docText, question);

  const userPrompt = `
DOCUMENT CONTEXT:
${relevantContext}

-----------------

USER QUESTION:
${question}

Grounded Answer:
`;

  // Prevent chat payload bloat by only keeping the last 10 messages (5 turns)
  const maxHistory = 10;
  const recentHistory = history.slice(-maxHistory);

  try {
    if (provider === 'openai') {
      if (!openaiClient) {
        console.warn('OpenAI API key missing. Running offline RAG simulation.');
        return runOfflineMockRAG(docText, question);
      }

      const messages: any[] = [{ role: 'system', content: systemPrompt }];
      
      // Inject history
      recentHistory.forEach((m) => {
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
      recentHistory.forEach((m) => {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        });
      });

      let currentParts: any[] = [];
      // Send raw file buffer only for images or scanned PDFs without extractable text
      const isMultimodalRequired = !!(fileBuffer && mimeType && (
        mimeType.startsWith('image/') || 
        (mimeType === 'application/pdf' && (!docText || docText.trim().length === 0))
      ));

      if (isMultimodalRequired) {
        currentParts.push({
          inlineData: {
            data: fileBuffer!.toString('base64'),
            mimeType: mimeType!,
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
If the question is about the document, you should answer using the facts in the document context.
If the user asks for summaries, key points, or highlights, generate them using the document content.
If the user greets you (e.g. "Hi", "Hello"), asks general formatting/coding questions, or engages in casual conversation, respond in a helpful, conversational manner.
Try to use the document context whenever relevant, but do not refuse to answer conversational or general questions.
`;

  // Dynamically select relevant text chunk to save tokens and improve response latency
  const relevantContext = getRelevantContext(docText, question);

  const userPrompt = `
DOCUMENT CONTEXT:
${relevantContext}

-----------------

USER QUESTION:
${question}

Grounded Answer:
`;

  // Prevent chat payload bloat by only keeping the last 10 messages (5 turns)
  const maxHistory = 10;
  const recentHistory = history.slice(-maxHistory);

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
      recentHistory.forEach((m) => {
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
      recentHistory.forEach((m) => {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        });
      });

      let currentParts: any[] = [];
      // Send raw file buffer only for images or scanned PDFs without extractable text
      const isMultimodalRequired = !!(fileBuffer && mimeType && (
        mimeType.startsWith('image/') || 
        (mimeType === 'application/pdf' && (!docText || docText.trim().length === 0))
      ));

      if (isMultimodalRequired) {
        currentParts.push({
          inlineData: {
            data: fileBuffer!.toString('base64'),
            mimeType: mimeType!,
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

/**
 * Generates exactly 3 suggested questions based on the document text.
 */
export const generateSuggestedQuestions = async (
  docText: string
): Promise<string[]> => {
  const defaultQuestions = [
    'Can you summarize the main points of this document?',
    'What is the primary topic or purpose of this document?',
    'Are there any key takeaways or action items?'
  ];

  if (!docText || docText.trim().length === 0) {
    return defaultQuestions;
  }

  const systemPrompt = `
You are a helpful AI Document Assistant.
Analyze the provided document text and generate exactly 3 interesting, relevant, and diverse questions that a user might want to ask about it.
Your questions should be specific to the document's content, rather than generic.

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON array of strings containing exactly 3 questions.
   Example output format:
   ["Specific question 1?", "Specific question 2?", "Specific question 3?"]
2. Do NOT write any introduction, greetings, code block markers, formatting, or markdown wrappers. Output ONLY raw JSON text.
`;

  const userPrompt = `
DOCUMENT CONTENT:
"""
${docText.substring(0, 15000)}
"""

3 Suggested Questions:
`;

  try {
    let rawText = '';
    if (provider === 'openai') {
      if (!openaiClient) {
        return defaultQuestions;
      }
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
      });
      rawText = response.choices[0]?.message?.content || '';
    } else {
      // Default to Gemini
      if (!googleGenAI) {
        return defaultQuestions;
      }
      const model = googleGenAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.5,
        }
      });
      rawText = result.response.text().trim();
    }

    // Clean code fences if AI didn't follow instructions
    let cleanedText = rawText.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }
    
    try {
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3).map(q => String(q).trim());
      }
    } catch (parseError) {
      console.warn('[AI Service] Failed to parse suggested questions JSON:', parseError, 'Raw response:', rawText);
      
      // Fallback parsing: look for lines starting with numbers or list indicators
      const questions: string[] = [];
      const lines = rawText.split('\n');
      for (const line of lines) {
        const cleanedLine = line.replace(/^\s*[-*#\d.]+\s*/, '').replace(/^["']|["']$/g, '').trim();
        if (cleanedLine.endsWith('?') && cleanedLine.length > 10) {
          questions.push(cleanedLine);
        }
        if (questions.length === 3) break;
      }
      if (questions.length >= 2) {
        return questions;
      }
    }
    return defaultQuestions;
  } catch (error) {
    console.error('[AI Service] Error generating suggested questions:', error);
    return defaultQuestions;
  }
};



