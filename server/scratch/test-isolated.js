const { generateGroundedAnswerStream } = require('../dist/services/aiService');
const { documentStore } = require('../dist/utils/documentStore');

async function test() {
  documentStore.setDocument('test.txt', 'This is a test document content about arrays in javascript.');
  
  console.log('Starting stream test...');
  const stream = generateGroundedAnswerStream(
    documentStore.getDocumentText(),
    'tell array',
    null,
    null
  );

  for await (const chunk of stream) {
    console.log(`CHUNK: "${chunk}"`);
  }
  console.log('Stream ended.');
}

test().catch(console.error);
