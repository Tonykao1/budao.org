const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('resident sheep stays visibly separate as the 44+1 sheep', () => {
  const loader = read('pasture-resident-runtime.js');
  const guardPath = 'pasture-resident-findability-guard.js';
  assert.equal(fs.existsSync(guardPath), true, 'findability guard is missing');
  const guard = read(guardPath);

  assert.match(loader, /pasture-resident-findability-guard\.js/);
  assert.match(guard, /MIN_SCALE/);
  assert.match(guard, /getImageData/);
  assert.match(guard, /findClearCandidate/);
  assert.match(guard, /blockedPixel/);
  assert.match(guard, /PastureResidentRuntime\.getLayout/);
  assert.match(guard, /layout\.x\s*=/);
  assert.match(guard, /layout\.y\s*=/);
  assert.match(guard, /layout\.s\s*=/);
});

test('findability correction persists the corrected daily position to the server sync layer',()=>{
  const guard=read('pasture-resident-findability-guard.js');
  assert.match(guard,/PastureResidentPositionSync/);
  assert.match(guard,/persistCurrent/);
});
