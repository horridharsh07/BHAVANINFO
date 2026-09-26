const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Start Drone Trigger Behavior...');

// 1. Verify index.html contains the button with correct label and function call
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

if (!htmlContent.includes('id="btn-trigger-drone-sim"')) {
  console.error('❌ FAIL: #btn-trigger-drone-sim button missing in index.html');
  process.exit(1);
}
console.log('  ✅ PASS: #btn-trigger-drone-sim present in index.html');

if (!htmlContent.includes('Start Drone LiDAR SLAM Survey')) {
  console.error('❌ FAIL: Button text does not match "Start Drone"');
  process.exit(1);
}
console.log('  ✅ PASS: Button text contains "Start Drone LiDAR SLAM Survey"');

// 2. Verify twin3d.js executeDroneScanSimulation has NO setInterval / setTimeout timer
const twinPath = path.join(__dirname, '..', 'src', 'twin3d.js');
const twinContent = fs.readFileSync(twinPath, 'utf8');

const execStart = twinContent.indexOf('executeDroneScanSimulation(onComplete)');
const execEnd = twinContent.indexOf('generateDefaultLevelsForParcel(parcel)', execStart);
const execBody = twinContent.substring(execStart, execEnd);

if (!execBody) {
  console.error('❌ FAIL: executeDroneScanSimulation method not found in twin3d.js');
  process.exit(1);
}

if (execBody.includes('setInterval') || execBody.includes('setTimeout') || execBody.includes('countdown') || execBody.includes('4s')) {
  console.error('❌ FAIL: executeDroneScanSimulation still contains timer or countdown logic!');
  process.exit(1);
}
console.log('  ✅ PASS: executeDroneScanSimulation has NO 4s timer or countdown delays (immediate execution)');

if (!execBody.includes('DRONE SURVEY MISSION DISPATCHED')) {
  console.error('❌ FAIL: Dispatched message missing in executeDroneScanSimulation');
  process.exit(1);
}
console.log('  ✅ PASS: Dispatched confirmation message is displayed immediately');

// 3. Verify app.js triggerLiveDroneSimulation does NOT turn parcel into DIGITALIZED and does NOT load extruded building
const appPath = path.join(__dirname, '..', 'src', 'app.js');
const appContent = fs.readFileSync(appPath, 'utf8');

const triggerMatch = appContent.match(/triggerLiveDroneSimulation\s*\(\)\s*\{([\s\S]*?)\n\s*\}/);
if (!triggerMatch) {
  console.error('❌ FAIL: triggerLiveDroneSimulation method not found in app.js');
  process.exit(1);
}

const triggerBody = triggerMatch[1];
if (triggerBody.includes("status = 'DIGITALIZED'") || triggerBody.includes('status = "DIGITALIZED"')) {
  console.error('❌ FAIL: triggerLiveDroneSimulation sets status to DIGITALIZED!');
  process.exit(1);
}
console.log('  ✅ PASS: triggerLiveDroneSimulation does NOT change status to DIGITALIZED');

if (triggerBody.includes('this.twin3d.loadParcel')) {
  console.error('❌ FAIL: triggerLiveDroneSimulation reloads parcel to show building!');
  process.exit(1);
}
console.log('  ✅ PASS: triggerLiveDroneSimulation does NOT extrude or show 3D building (remains unbuilt & pending)');

console.log('\n=======================================================');
console.log('🎉 ALL START DRONE BEHAVIOR TESTS PASSED (100%)!');
console.log('=======================================================');
