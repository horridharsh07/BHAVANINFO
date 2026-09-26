const http = require('http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataStr)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Running Comprehensive Auth, Dynamic OTP, Soft Copy & e-KYC Tests...');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: Send OTP with invalid Aadhaar (< 12 digits)
    const t1 = await postJson('/api/auth/send-otp', { aadhaar: '12345', mobile: '9876543210' });
    assert(t1.statusCode === 400 && t1.data.error.includes('12-digit'), 'Rejects Aadhaar < 12 digits');

    // Test 2: Send OTP with invalid Mobile (< 10 digits)
    const t2 = await postJson('/api/auth/send-otp', { aadhaar: '549288128921', mobile: '1234' });
    assert(t2.statusCode === 400 && t2.data.error.includes('10-digit'), 'Rejects Mobile < 10 digits');

    // Test 3: Send real dynamic OTP
    const aadhaarTest = '789123456789';
    const mobileTest = '9876501234';
    const t3 = await postJson('/api/auth/send-otp', { aadhaar: aadhaarTest, mobile: mobileTest });
    assert(t3.statusCode === 200 && t3.data.success === true, 'Dispatches real dynamic OTP successfully');
    assert(typeof t3.data.otp_code === 'string' && t3.data.otp_code.length === 6, 'Dynamic OTP is 6 digits');
    const dynamicOtp = t3.data.otp_code;

    // Test 4: Document Soft Copy verification with matching digits
    const t4 = await postJson('/api/auth/verify-document', {
      input_aadhaar: aadhaarTest,
      file_name: 'aadhaar_front_back.pdf',
      doc_digits: aadhaarTest
    });
    assert(t4.statusCode === 200 && t4.data.matches === true, 'Document soft copy matches input digits');

    // Test 5: Document Soft Copy verification with mismatched digits
    const t5 = await postJson('/api/auth/verify-document', {
      input_aadhaar: aadhaarTest,
      file_name: 'wrong_aadhaar.pdf',
      doc_digits: '111122223333'
    });
    assert(t5.statusCode === 200 && t5.data.matches === false, 'Document soft copy detects mismatch correctly');

    // Test 6: Verify wrong OTP
    const t6 = await postJson('/api/auth/verify-otp', {
      aadhaar: aadhaarTest,
      mobile: mobileTest,
      otp: '000000'
    });
    assert(t6.statusCode === 400 && t6.data.error.includes('Invalid OTP'), 'Rejects incorrect OTP');

    // Test 7: Verify correct dynamic OTP -> Returns citizen with ZERO properties!
    const t7 = await postJson('/api/auth/verify-otp', {
      name: 'Simranjeet Kaur',
      aadhaar: aadhaarTest,
      mobile: mobileTest,
      otp: dynamicOtp,
      document_matched: true,
      face_verified: true
    });
    assert(t7.statusCode === 200 && t7.data.success === true, 'Dynamic OTP verified successfully');
    assert(Array.isArray(t7.data.profile.properties_owned) && t7.data.profile.properties_owned.length === 0, 'Real login citizen account has EXACTLY 0 properties owned');
    assert(t7.data.ekyc_status.face_verified === true, 'Face e-KYC status captured in session');
    assert(t7.data.ekyc_status.document_matched === true, 'Document match status recorded');

    // Test 8: Demo Evaluator Login (Harpreet Singh retains sample 3D properties)
    const t8 = await postJson('/api/auth/verify-otp', {
      aadhaar: '549288128921',
      otp: '849201'
    });
    assert(t8.statusCode === 200 && t8.data.profile.name.includes('Harpreet'), 'Demo Harpreet Singh login accessible for evaluator');
    assert(Array.isArray(t8.data.profile.properties_owned) && t8.data.profile.properties_owned.length >= 3, 'Demo account retains sample properties for 3D digital twin review');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runTests();
