import { generateGroundedAnswerStream } from '../src/services/aiService';
import { documentStore } from '../src/utils/documentStore';

async function test() {
  documentStore.setDocument('test.txt', 'This is a test document content about arrays in javascript.');
  
  console.log('Starting stream test...');
  const stream = generateGroundedAnswerStream(
    documentStore.getDocumentText() || '',
    'tell array',
    null,
    null
  );

  let chunkCount = 0;
  for await (const chunk of stream) {
    chunkCount++;
    console.log(`CHUNK ${chunkCount}: "${chunk}"`);
  }
  console.log('Stream ended.');
}

test().catch(console.error);
