const fetch = require('node-fetch');
const fs = require('fs');

async function testExport() {
  console.log('Testing /api/export...');
  try {
    const res = await fetch('http://localhost:3000/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-project',
        files: {
          'test.md': '# Hello World',
          'nested/file.txt': 'Nested content'
        }
      })
    });

    if (res.ok) {
      const buffer = await res.buffer();
      fs.writeFileSync('test-export.zip', buffer);
      console.log('SUCCESS: Exported zip saved to test-export.zip');
    } else {
      console.error('FAILURE:', await res.text());
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

testExport();
